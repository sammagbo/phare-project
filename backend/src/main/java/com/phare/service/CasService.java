package com.phare.service;

import com.phare.model.Cas;
import com.phare.model.Eleve;
import com.phare.repository.CasRepository;
import com.phare.repository.EleveRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Service de gestion des cas et des entretiens.
 * Délègue la persistance aux repositories (PostgreSQL via JPA).
 */
@Service
@Transactional
public class CasService {

    private final CasRepository casRepository;
    private final EleveRepository eleveRepository;

    public CasService(CasRepository casRepository, EleveRepository eleveRepository) {
        this.casRepository = casRepository;
        this.eleveRepository = eleveRepository;
    }

    // ═══════════════════════════════════════════
    //  CAS — CRUD
    // ═══════════════════════════════════════════

    /** Retourne tous les cas, triés du plus récent au plus ancien. */
    public List<Cas> getAll() {
        return casRepository.findAllByOrderByIdDesc();
    }

    /** Recherche un cas par ID. */
    public Optional<Cas> getById(Long id) {
        return casRepository.findById(id);
    }

    /**
     * Crée un nouveau cas.
     * La relation bidirectionnelle est maintenue par Cas.setEleves().
     */
    public Cas create(Cas cas) {
        // S'assurer que chaque élève pointe vers ce cas
        if (cas.getEleves() != null) {
            cas.getEleves().forEach(e -> e.setCas(cas));
        }
        return casRepository.save(cas);
    }

    /**
     * Met à jour un cas existant.
     * orphanRemoval supprime les élèves retirés de la liste.
     */
    public Optional<Cas> update(Long id, Cas updated) {
        return casRepository.findById(id).map(existing -> {
            existing.setDate(updated.getDate());
            existing.setHeure(updated.getHeure());
            existing.setEleves(updated.getEleves());
            return casRepository.save(existing);
        });
    }

    /** Supprime un cas et tous ses élèves (cascade). */
    public boolean delete(Long id) {
        if (casRepository.existsById(id)) {
            casRepository.deleteById(id);
            return true;
        }
        return false;
    }

    /** Recherche par nom d'élève (partiel, insensible à la casse). */
    public List<Cas> searchByEleve(String nom) {
        return casRepository.findByElevesNomContainingIgnoreCase(nom);
    }

    // ═══════════════════════════════════════════
    //  ENTRETIENS — Planification
    // ═══════════════════════════════════════════

    /**
     * Planifie un entretien pour un élève donné.
     * @param eleveId    ID de l'élève
     * @param date       Date de l'entretien (YYYY-MM-DD)
     * @param heure      Heure de l'entretien (HH:mm)
     * @param membre     Membre pHARe désigné
     */
    public Optional<Eleve> scheduleEntretien(Long eleveId, String date, String heure, String membre) {
        return eleveRepository.findById(eleveId).map(eleve -> {
            eleve.setDateEntretien(date);
            eleve.setHeureEntretien(heure);
            eleve.setMembreEntretien(membre);
            return eleveRepository.save(eleve);
        });
    }

    /**
     * Annule un entretien en effaçant ses champs.
     */
    public Optional<Eleve> cancelEntretien(Long eleveId) {
        return eleveRepository.findById(eleveId).map(eleve -> {
            eleve.setDateEntretien(null);
            eleve.setHeureEntretien(null);
            eleve.setMembreEntretien(null);
            return eleveRepository.save(eleve);
        });
    }

    /** Élèves avec entretien planifié. */
    public List<Eleve> getScheduledEntretiens() {
        return eleveRepository.findByDateEntretienIsNotNull();
    }

    /** Élèves sans entretien (en attente). */
    public List<Eleve> getPendingEntretiens() {
        return eleveRepository.findByDateEntretienIsNull();
    }
}

