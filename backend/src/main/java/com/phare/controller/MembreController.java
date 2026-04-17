package com.phare.controller;

import com.phare.model.Membre;
import com.phare.service.MembreService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST pour la gestion des membres pHARe.
 *
 *   GET    /api/membres         → Lister tous les membres
 *   POST   /api/membres         → Ajouter un membre
 *   DELETE /api/membres/{id}    → Supprimer un membre
 */
@RestController
@RequestMapping("/api/membres")
public class MembreController {

    private final MembreService membreService;

    public MembreController(MembreService membreService) {
        this.membreService = membreService;
    }

    @GetMapping
    public List<Membre> getAll() {
        return membreService.getAll();
    }

    @PostMapping
    public ResponseEntity<?> add(@RequestBody Map<String, String> body) {
        String nom = body.get("nom");
        return membreService.add(nom)
                .map(m -> ResponseEntity.status(HttpStatus.CREATED).body((Object) m))
                .orElse(ResponseEntity.badRequest()
                        .body(Map.of("error", "Membre déjà existant ou nom invalide")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        if (membreService.delete(id)) {
            return ResponseEntity.ok(Map.of("message", "Membre supprimé"));
        }
        return ResponseEntity.notFound().build();
    }
}
