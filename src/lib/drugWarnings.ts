/**
 * The six standard Indonesian "obat bebas terbatas" (Daftar W) warning labels
 * — BPOM requires one of these, verbatim, on every limited-OTC product.
 *
 * Kept as reference text an admin picks from, not an enum: `products.warning`
 * stays a free string so a product can carry the exact wording its packaging
 * shows, and picking a code here just fills the field rather than replacing it.
 */
export const drugWarnings = [
    { code: 'P1', text: 'Awas! Obat Keras. Bacalah aturan pemakaiannya.' },
    { code: 'P2', text: 'Awas! Obat Keras. Hanya untuk dikumur, jangan ditelan.' },
    { code: 'P3', text: 'Awas! Obat Keras. Hanya untuk bagian luar dari badan.' },
    { code: 'P4', text: 'Awas! Obat Keras. Hanya untuk dibakar.' },
    { code: 'P5', text: 'Awas! Obat Keras. Tidak boleh ditelan.' },
    { code: 'P6', text: 'Awas! Obat Keras. Obat wasir, jangan ditelan.' },
];
