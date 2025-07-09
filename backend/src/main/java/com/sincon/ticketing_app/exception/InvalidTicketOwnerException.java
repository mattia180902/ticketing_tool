package com.sincon.ticketing_app.exception;

public class InvalidTicketOwnerException extends RuntimeException {
    public InvalidTicketOwnerException(String message) {
        super(message);
    }
}