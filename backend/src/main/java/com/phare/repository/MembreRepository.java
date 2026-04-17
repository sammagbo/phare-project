package com.phare.repository;

import com.phare.model.Membre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository JPA pour les membres de l'équipe pHARe.
 */
@Repository
public interface MembreRepository extends JpaRepository<Membre, Long> {

    /** Tous les membres, triés alphabétiquement. */
    List<Membre> findAllByOrderByNomAsc();

    /** Recherche par nom exact (pour éviter les doublons). */
    Optional<Membre> findByNomIgnoreCase(String nom);

    /** Vérifie si un membre existe par nom. */
    boolean existsByNomIgnoreCase(String nom);
}
