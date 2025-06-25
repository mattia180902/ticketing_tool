package com.sincon.ticketing_app.user;

import jakarta.validation.constraints.Pattern;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserContactUpdateRequest {
    @Pattern(regexp = UserConstants.FISCAL_CODE_REGEX)
    private String fiscalCode;

    @Pattern(regexp = UserConstants.PHONE_NUMBER_REGEX)
    private String phoneNumber;
}
