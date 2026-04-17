package com.phare;

import com.phare.service.MembreService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.List;

@SpringBootApplication
public class PhareApplication {
    public static void main(String[] args) {
        SpringApplication.run(PhareApplication.class, args);
    }

    /**
     * Seed les membres par défaut au premier lancement.
     */
    @Bean
    CommandLineRunner seedMembers(MembreService membreService) {
        return args -> membreService.seedIfEmpty(List.of(
            "[nom retiré]", "[nom retiré]", "[nom retiré]",
            "[nom retiré]", "[nom retiré]", "[nom retiré]",
            "[nom retiré]", "[nom retiré]", "[nom retiré]",
            "[nom retiré]", "[nom retiré]",
            "[nom retiré]", "[nom retiré]", "[nom retiré]"
        ));
    }
}
