package com.phare.service;

import com.phare.model.Membre;
import com.phare.repository.MembreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Service de gestion des membres de l'équipe pHARe.
 */
@Service
@Transactional
public class MembreService {

    private final MembreRepository membreRepository;

    public MembreService(MembreRepository membreRepository) {
        this.membreRepository = membreRepository;
    }

    /** Retourne tous les membres, triés alphabétiquement. */
    public List<Membre> getAll() {
        return membreRepository.findAllByOrderByNomAsc();
    }

    /**
     * Ajoute un membre s'il n'existe pas déjà.
     * @return le membre créé, ou empty si doublon.
     */
    public Optional<Membre> add(String nom) {
        if (nom == null || nom.isBlank()) return Optional.empty();
        if (membreRepository.existsByNomIgnoreCase(nom.trim())) return Optional.empty();
        return Optional.of(membreRepository.save(new Membre(nom.trim())));
    }

    /** Supprime un membre par ID. */
    public boolean delete(Long id) {
        if (membreRepository.existsById(id)) {
            membreRepository.deleteById(id);
            return true;
        }
        return false;
    }

    /**
     * Initialise la liste si la table est vide (premiers lancement).
     */
    public void seedIfEmpty(List<String> defaultNames) {
        if (membreRepository.count() == 0) {
            defaultNames.forEach(name -> membreRepository.save(new Membre(name)));
        }
    }
}
