package com.xgs.promptforge.repo;

import com.xgs.promptforge.entity.CustomStyle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomStyleRepository extends JpaRepository<CustomStyle, Long> {

    Optional<CustomStyle> findByStyleKey(String styleKey);
}
