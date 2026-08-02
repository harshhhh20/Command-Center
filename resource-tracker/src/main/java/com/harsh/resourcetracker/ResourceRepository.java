package com.harsh.resourcetracker;

import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceRepository extends JpaRepository<Resource, Long> {
    List<Resource> findByStatus(String status);
    List<Resource> findByStatusNot(String status);

    @Query("SELECT r.difficulty, COUNT(r) FROM Resource r GROUP BY r.difficulty")
    List<Object[]> countByDifficulty();
}