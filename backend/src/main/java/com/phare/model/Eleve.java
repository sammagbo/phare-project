package com.phare.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Entité JPA représentant un élève impliqué dans un cas.
 * Table : eleves
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

    @NotNull(message = "Le type est obligatoire (VICTIME, TEMOIN, INTIMIDATEUR)")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TypeEleve type;

    /** Membre pHARe assigné (facultatif) */
    private String membre;

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

    public TypeEleve getType() { return type; }
    public void setType(TypeEleve type) { this.type = type; }

    public String getMembre() { return membre; }
    public void setMembre(String membre) { this.membre = membre; }

    public Cas getCas() { return cas; }
    public void setCas(Cas cas) { this.cas = cas; }
}
