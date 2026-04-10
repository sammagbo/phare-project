package com.phare.service;

import com.phare.model.Cas;
import com.phare.repository.CasRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Service de gestion des cas.
 * Délègue la persistance au CasRepository (PostgreSQL via JPA).
 */
@Service
@Transactional
public class CasService {

    private final CasRepository casRepository;

    public CasService(CasRepository casRepository) {
        this.casRepository = casRepository;
    }

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
}
