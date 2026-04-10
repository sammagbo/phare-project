package com.phare.controller;

import com.phare.model.Cas;
import com.phare.service.CasService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST — mêmes endpoints que la version précédente.
 *
 *   GET    /api/cas              → Lister tous les cas
 *   GET    /api/cas/{id}         → Obtenir un cas par ID
 *   GET    /api/cas?search=nom   → Rechercher par nom d'élève
 *   POST   /api/cas              → Créer un nouveau cas
 *   PUT    /api/cas/{id}         → Modifier un cas existant
 *   DELETE /api/cas/{id}         → Supprimer un cas
 */
@RestController
@RequestMapping("/api/cas")
public class CasController {

    private final CasService casService;

    public CasController(CasService casService) {
        this.casService = casService;
    }

    @GetMapping
    public List<Cas> getAll(@RequestParam(required = false) String search) {
        if (search != null && !search.isBlank()) {
            return casService.searchByEleve(search.trim());
        }
        return casService.getAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cas> getById(@PathVariable Long id) {
        return casService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Cas> create(@Valid @RequestBody Cas cas) {
        Cas created = casService.create(cas);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Cas> update(@PathVariable Long id, @Valid @RequestBody Cas cas) {
        return casService.update(id, cas)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        if (casService.delete(id)) {
            return ResponseEntity.ok(Map.of("message", "Cas supprimé avec succès"));
        }
        return ResponseEntity.notFound().build();
    }
}
