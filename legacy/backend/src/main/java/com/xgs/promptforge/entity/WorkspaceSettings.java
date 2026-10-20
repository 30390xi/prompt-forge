package com.xgs.promptforge.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "workspace_settings")
public class WorkspaceSettings {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    /** 多项目父目录绝对路径 */
    @Column(length = 1024)
    private String parentFolder;

    /** 仓库发现深度：0=仅直接子目录，1=再向下一层 */
    @Column(nullable = false)
    private int scanDepth = 1;

    @Column(nullable = false, length = 64)
    private String timezone = "Asia/Shanghai";

    /** 覆盖各仓库 git user.name */
    @Column(length = 128)
    private String authorOverride;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getParentFolder() {
        return parentFolder;
    }

    public void setParentFolder(String parentFolder) {
        this.parentFolder = parentFolder;
    }

    public int getScanDepth() {
        return scanDepth;
    }

    public void setScanDepth(int scanDepth) {
        this.scanDepth = scanDepth;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public String getAuthorOverride() {
        return authorOverride;
    }

    public void setAuthorOverride(String authorOverride) {
        this.authorOverride = authorOverride;
    }
}
