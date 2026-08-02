package com.harsh.resourcetracker;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "users")
@Data
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String username;
    
    @Column(nullable = false)
    private String password;

    // Per-user auth token (UUID). Stored so we can look up the user from a token.
    @Column(unique = true)
    private String token;
}