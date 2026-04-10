package com.phare.model;

import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.ArrayList;
import java.util.List;

/**
 * Entité JPA représentant un cas de harcèlement scolaire.
 * Table : cas
 *
 * Relation : Un Cas contient plusieurs Eleves (OneToMany).
 * CascadeType.ALL + orphanRemoval : les élèves sont créés,
 * modifiés et supprimés automatiquement avec le cas.
 */
@Entity
@Table(name = "cas")
public class Cas {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "La date est obligatoire")
    @Column(nullable = false)
    private String date;

    @NotBlank(message = "L'heure est obligatoire")
    @Column(nullable = false)
    private String heure;

    @OneToMany(
        mappedBy = "cas",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.EAGER
    )
    @NotEmpty(message = "Le cas doit contenir au moins un élève")
    @Valid
    private List<Eleve> eleves = new ArrayList<>();

    // ── Constructeurs ──

    public Cas() {}

    public Cas(String date, String heure, List<Eleve> eleves) {
        this.date = date;
        this.heure = heure;
        this.setEleves(eleves);
    }

    // ── Getters & Setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public String getHeure() { return heure; }
    public void setHeure(String heure) { this.heure = heure; }

    public List<Eleve> getEleves() { return eleves; }

    /**
     * Setter qui maintient la relation bidirectionnelle.
     * Chaque élève reçoit une référence vers ce cas.
     */
    public void setEleves(List<Eleve> eleves) {
        this.eleves.clear();
        if (eleves != null) {
            eleves.forEach(e -> {
                e.setCas(this);
                this.eleves.add(e);
            });
        }
    }
}
