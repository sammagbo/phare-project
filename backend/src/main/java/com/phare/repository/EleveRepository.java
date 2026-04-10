package com.phare.repository;

import com.phare.model.Eleve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository JPA pour les élèves.
 */
@Repository
public interface EleveRepository extends JpaRepository<Eleve, Long> {
}
