/** The phone field's rules on sign-up and "Verifikasi Nomor Telepon"; uniqueness is checked separately. */
export const PHONE_RULES = ["required", "string", "max:30", "regex:/^[0-9+\\-\\s()]+$/"];

export const PHONE_REGEX_MESSAGE = "Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( ).";
