package com.harsh.resourcetracker;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Long> {
    
    // Finds a specific folder to see if it already exists
    Optional<Folder> findByName(String name);

    // Grabs all existing folder names to feed to the AI
    @Query("SELECT f.name FROM Folder f")
    List<String> findAllFolderNames();
}