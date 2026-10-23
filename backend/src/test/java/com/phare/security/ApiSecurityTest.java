package com.phare.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Chaque endpoint de l'API exige le token d'accès du contrat ; le CORS n'accepte que les origines du frontend. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiSecurityTest {

    private static final String OTHER_SECRET = "another-secret-that-is-long-enough-0123456789";

    @Autowired
    private MockMvc mvc;

    @Value("${phare.jwt.secret}")
    private String secret;

    /** Un token signé ici même, en HS256, avec le secret et les claims donnés. */
    private static String token(String secret, String issuer, String audience, Instant issuedAt, Duration ttl) {
        NimbusJwtEncoder encoder = new NimbusJwtEncoder(new ImmutableSecret<>(secret.getBytes(StandardCharsets.UTF_8)));
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .audience(List.of(audience))
                .subject("1")
                .claim("email", "membre@example.com")
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plus(ttl))
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    private String validToken() {
        return token(secret, SecurityConfig.ISSUER, SecurityConfig.AUDIENCE, Instant.now(), Duration.ofMinutes(15));
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    @Test
    void readingTheCasesWithoutATokenIs401() throws Exception {
        mvc.perform(get("/api/cas")).andExpect(status().isUnauthorized());
    }

    @Test
    void creatingACaseWithoutATokenIs401() throws Exception {
        mvc.perform(post("/api/cas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-10-22\",\"heure\":\"10:00\",\"eleves\":[{\"nom\":\"Élève Exemple\",\"type\":\"TEMOIN\"}]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theOtherEndpointsWithoutATokenAre401() throws Exception {
        mvc.perform(get("/api/entretiens")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/membres")).andExpect(status().isUnauthorized());
    }

    @Test
    void aValidTokenIs200() throws Exception {
        mvc.perform(get("/api/cas").header(HttpHeaders.AUTHORIZATION, bearer(validToken()))).andExpect(status().isOk());
    }

    @Test
    void aTokenSignedWithAnotherSecretIs401() throws Exception {
        String forged = token(OTHER_SECRET, SecurityConfig.ISSUER, SecurityConfig.AUDIENCE, Instant.now(), Duration.ofMinutes(15));
        mvc.perform(get("/api/cas").header(HttpHeaders.AUTHORIZATION, bearer(forged))).andExpect(status().isUnauthorized());
    }

    @Test
    void anExpiredTokenIs401() throws Exception {
        // expiré depuis 10 minutes, bien au-delà de la marge de 60 s
        String expired = token(secret, SecurityConfig.ISSUER, SecurityConfig.AUDIENCE, Instant.now().minus(Duration.ofMinutes(25)), Duration.ofMinutes(15));
        mvc.perform(get("/api/cas").header(HttpHeaders.AUTHORIZATION, bearer(expired))).andExpect(status().isUnauthorized());
    }

    @Test
    void anotherIssuerIs401() throws Exception {
        String other = token(secret, "another-issuer", SecurityConfig.AUDIENCE, Instant.now(), Duration.ofMinutes(15));
        mvc.perform(get("/api/cas").header(HttpHeaders.AUTHORIZATION, bearer(other))).andExpect(status().isUnauthorized());
    }

    @Test
    void anotherAudienceIs401() throws Exception {
        String other = token(secret, SecurityConfig.ISSUER, "another-api", Instant.now(), Duration.ofMinutes(15));
        mvc.perform(get("/api/cas").header(HttpHeaders.AUTHORIZATION, bearer(other))).andExpect(status().isUnauthorized());
    }

    @Test
    void thePreflightOfTheFrontendIsAllowed() throws Exception {
        mvc.perform(options("/api/cas")
                        .header(HttpHeaders.ORIGIN, "http://localhost:8000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:8000"));
    }

    @Test
    void thePreflightOfAnotherOriginIs403() throws Exception {
        mvc.perform(options("/api/cas")
                        .header(HttpHeaders.ORIGIN, "http://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void theDecoderRefusesAShortOrMissingSecret() {
        assertThatThrownBy(() -> SecurityConfig.decoder("x".repeat(31)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET");
        assertThatThrownBy(() -> SecurityConfig.decoder("")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> SecurityConfig.decoder(null)).isInstanceOf(IllegalStateException.class);
        assertThatCode(() -> SecurityConfig.decoder("x".repeat(32))).doesNotThrowAnyException();
    }
}
