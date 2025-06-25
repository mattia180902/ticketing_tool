package com.sincon.ticketing_app.enums;

public enum UserRole {
    ADMIN(3, false),
    HELPER_JUNIOR(0, true),
    HELPER_SENIOR(1, true),
    PM(2, false),
    USER(-1, false);

    private final int level;
    private final boolean isHelper;

    UserRole(int level, boolean isHelper) {
        this.level = level;
        this.isHelper = isHelper;
    }

    public int getLevel() {
        return level;
    }

    public boolean isHelper() {
        return isHelper;
    }
}
