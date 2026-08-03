package com.harsh.resourcetracker;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ResourceRepository extends JpaRepository<Resource, Long> {

    // Global (kept for backward compat, not used in controller anymore)
    List<Resource> findByStatus(String status);
    List<Resource> findByStatusNot(String status);

    // User-scoped queries — the real deal
    List<Resource> findByUserIdAndStatusNot(Long userId, String status);
    List<Resource> findByUserIdAndStatus(Long userId, String status);
    boolean existsByUrlAndUserId(String url, Long userId);

    @Query("SELECT r.difficulty, COUNT(r) FROM Resource r WHERE r.user.id = :userId AND r.difficulty IS NOT NULL GROUP BY r.difficulty")
    List<Object[]> countByDifficultyForUser(Long userId);

    // Global difficulty count (fallback)
    @Query("SELECT r.difficulty, COUNT(r) FROM Resource r WHERE r.difficulty IS NOT NULL GROUP BY r.difficulty")
    List<Object[]> countByDifficulty();

    // Cache lookup for AI Scanner
    Resource findFirstByUrl(String url);

    // Bulk archive — sets status to 'Archived' for multiple IDs owned by the user
    @Modifying
    @Transactional
    @Query("UPDATE Resource r SET r.status = 'Archived' WHERE r.id IN :ids AND r.user.id = :userId")
    void archiveBulkByIdsAndUserId(@Param("ids") List<Long> ids, @Param("userId") Long userId);
}