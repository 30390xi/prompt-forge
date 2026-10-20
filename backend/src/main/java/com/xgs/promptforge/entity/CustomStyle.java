package com.xgs.promptforge.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "custom_style")
public class CustomStyle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32)
    private String styleKey;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(nullable = false, length = 1000)
    private String guide;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getStyleKey() {
        return styleKey;
    }

    public void setStyleKey(String styleKey) {
        this.styleKey = styleKey;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getGuide() {
        return guide;
    }

    public void setGuide(String guide) {
        this.guide = guide;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
