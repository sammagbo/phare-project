package com.phare.repository;

import com.phare.model.Eleve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository JPA pour les élèves.
 * Inclut des requêtes pour la planification des entretiens.
 */
@Repository
public interface EleveRepository extends JpaRepository<Eleve, Long> {

    /** Élèves avec un entretien planifié (date renseignée). */
    List<Eleve> findByDateEntretienIsNotNull();

    /** Élèves sans entretien planifié (date non renseignée). */
    List<Eleve> findByDateEntretienIsNull();

    /** Élèves d'un cas donné. */
    List<Eleve> findByCasId(Long casId);
}

