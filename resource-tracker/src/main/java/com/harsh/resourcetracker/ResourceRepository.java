package com.harsh.resourcetracker;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceRepository extends JpaRepository<Resource, Long> {

    // Global (kept for backward compat, not used in controller anymore)
    List<Resource> findByStatus(String status);
    List<Resource> findByStatusNot(String status);

    // User-scoped queries — the real deal
    List<Resource> findByUserIdAndStatusNot(Long userId, String status);
    List<Resource> findByUserIdAndStatus(Long userId, String status);

    @Query("SELECT r.difficulty, COUNT(r) FROM Resource r WHERE r.user.id = :userId GROUP BY r.difficulty")
    List<Object[]> countByDifficultyForUser(Long userId);

    // Global difficulty count (fallback)
    @Query("SELECT r.difficulty, COUNT(r) FROM Resource r GROUP BY r.difficulty")
    List<Object[]> countByDifficulty();
}