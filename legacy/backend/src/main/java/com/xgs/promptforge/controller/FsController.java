package com.xgs.promptforge.controller;

import com.xgs.promptforge.util.PathSafety;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/fs")
public class FsController {

    @GetMapping("/list")
    public Map<String, Object> list(@RequestParam(required = false) String path) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            Path dir;
            if (path == null || path.isBlank()) {
                dir = Path.of(System.getProperty("user.home")).toAbsolutePath().normalize();
            } else {
                dir = PathSafety.requireAbsoluteDirectory(path);
            }
            List<Map<String, String>> entries = new ArrayList<>();
            try (Stream<Path> children = Files.list(dir)) {
                children.filter(Files::isDirectory)
                        .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                        .forEach(p -> {
                            Map<String, String> item = new LinkedHashMap<>();
                            item.put("name", p.getFileName().toString());
                            item.put("path", p.toAbsolutePath().normalize().toString());
                            entries.add(item);
                        });
            }
            resp.put("ok", true);
            resp.put("current", dir.toString());
            resp.put("parent", PathSafety.parentPath(dir).toString());
            resp.put("entries", entries);
        } catch (Exception e) {
            resp.put("ok", false);
            resp.put("error", e.getMessage());
        }
        return resp;
    }
}
