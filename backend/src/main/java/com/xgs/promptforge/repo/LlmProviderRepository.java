package com.xgs.promptforge.repo;

import com.xgs.promptforge.entity.LlmProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LlmProviderRepository extends JpaRepository<LlmProvider, Long> {

    Optional<LlmProvider> findByActiveTrue();

    List<LlmProvider> findAllByOrderByIdAsc();

    Optional<LlmProvider> findByPresetKey(String presetKey);
}
