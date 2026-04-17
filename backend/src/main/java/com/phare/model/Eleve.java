package com.phare.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Entité JPA représentant un élève impliqué dans un cas.
 * Table : eleves
 *
 * Champs principaux : nom, type, classe, membre (assignation initiale)
 * Champs de liaison : lieA (lien victime pour témoins/intimidateurs)
 * Champs entretien : dateEntretien, heureEntretien, membreEntretien
 */
@Entity
@Table(name = "eleves")
public class Eleve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le nom de l'élève est obligatoire")
    @Column(nullable = false)
    private String nom;

    /** Classe de l'élève (ex: "6ème A") */
    private String classe;

    @NotNull(message = "Le type est obligatoire (VICTIME, TEMOIN, INTIMIDATEUR)")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TypeEleve type;

    /** Membre pHARe assigné lors de la création du cas (facultatif) */
    private String membre;

    /**
     * Lien vers la victime associée (pour témoins et intimidateurs).
     * Mappé en JSON comme "lie_a" pour compatibilité avec le frontend.
     */
    @JsonProperty("lie_a")
    @Column(name = "lie_a")
    private String lieA;

    // ── Champs Entretien (planification) ──

    /** Date de l'entretien planifié (format: YYYY-MM-DD) */
    @Column(name = "date_entretien")
    @JsonProperty("dateEntretien")
    private String dateEntretien;

    /** Heure de l'entretien planifié (format: HH:mm) */
    @Column(name = "heure_entretien")
    @JsonProperty("heureEntretien")
    private String heureEntretien;

    /** Membre pHARe désigné pour conduire l'entretien */
    @Column(name = "membre_entretien")
    @JsonProperty("membreEntretien")
    private String membreEntretien;

    /** Relation inverse vers le cas parent */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cas_id")
    @JsonIgnore
    private Cas cas;

    // ── Constructeurs ──

    public Eleve() {}

    public Eleve(String nom, TypeEleve type, String membre) {
        this.nom = nom;
        this.type = type;
        this.membre = membre;
    }

    // ── Getters & Setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public String getClasse() { return classe; }
    public void setClasse(String classe) { this.classe = classe; }

    public TypeEleve getType() { return type; }
    public void setType(TypeEleve type) { this.type = type; }

    public String getMembre() { return membre; }
    public void setMembre(String membre) { this.membre = membre; }

    public String getLieA() { return lieA; }
    public void setLieA(String lieA) { this.lieA = lieA; }

    public String getDateEntretien() { return dateEntretien; }
    public void setDateEntretien(String dateEntretien) { this.dateEntretien = dateEntretien; }

    public String getHeureEntretien() { return heureEntretien; }
    public void setHeureEntretien(String heureEntretien) { this.heureEntretien = heureEntretien; }

    public String getMembreEntretien() { return membreEntretien; }
    public void setMembreEntretien(String membreEntretien) { this.membreEntretien = membreEntretien; }

    public Cas getCas() { return cas; }
    public void setCas(Cas cas) { this.cas = cas; }
}
