package com.sincon.ticketing_app.exception;

public class InvalidAssigneeRoleException extends RuntimeException {
    public InvalidAssigneeRoleException(String message) {
        super(message);
    }
}