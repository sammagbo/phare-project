package com.phare.controller;

import com.phare.model.Eleve;
import com.phare.service.CasService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST pour la planification des entretiens.
 *
 *   GET    /api/entretiens             → Lister les entretiens planifiés
 *   GET    /api/entretiens/pending     → Lister les élèves en attente
 *   PUT    /api/entretiens/{eleveId}   → Planifier / modifier un entretien
 *   DELETE /api/entretiens/{eleveId}   → Annuler un entretien
 */
@RestController
@RequestMapping("/api/entretiens")
public class EntretienController {

    private final CasService casService;

    public EntretienController(CasService casService) {
        this.casService = casService;
    }

    /**
     * Liste tous les élèves ayant un entretien planifié.
     */
    @GetMapping
    public List<Eleve> getScheduled() {
        return casService.getScheduledEntretiens();
    }

    /**
     * Liste tous les élèves en attente d'un entretien.
     */
    @GetMapping("/pending")
    public List<Eleve> getPending() {
        return casService.getPendingEntretiens();
    }

    /**
     * Planifie ou met à jour un entretien pour un élève.
     * Body attendu : { "date": "2026-04-20", "heure": "14:00", "membre": "Antoine Kopp" }
     */
    @PutMapping("/{eleveId}")
    public ResponseEntity<Eleve> schedule(
            @PathVariable Long eleveId,
            @RequestBody Map<String, String> body
    ) {
        String date = body.get("date");
        String heure = body.get("heure");
        String membre = body.get("membre");

        if (date == null || date.isBlank() || membre == null || membre.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return casService.scheduleEntretien(eleveId, date, heure, membre)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Annule l'entretien d'un élève (efface date, heure, membre).
     */
    @DeleteMapping("/{eleveId}")
    public ResponseEntity<Map<String, String>> cancel(@PathVariable Long eleveId) {
        return casService.cancelEntretien(eleveId)
                .map(e -> ResponseEntity.ok(Map.of("message", "Entretien annulé")))
                .orElse(ResponseEntity.notFound().build());
    }
}
