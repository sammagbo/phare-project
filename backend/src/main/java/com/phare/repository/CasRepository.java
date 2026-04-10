package com.phare.repository;

import com.phare.model.Cas;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository JPA pour les cas de harcèlement.
 * Spring Data génère automatiquement les requêtes SQL.
 */
@Repository
public interface CasRepository extends JpaRepository<Cas, Long> {

    /** Récupère tous les cas triés du plus récent au plus ancien. */
    List<Cas> findAllByOrderByIdDesc();

    /** Recherche les cas contenant un élève par nom (partiel). */
    List<Cas> findByElevesNomContainingIgnoreCase(String nom);
}
