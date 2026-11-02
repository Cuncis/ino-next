import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { FULFILMENTS, options as optionsOf } from "@/lib/admin-options";
import { orderFormOptions } from "./orders";

/** What OrderForm needs from the server: the selects' choices and its words, translated. */
export async function orderFormProps(locale: AdminLocale) {
  const t = (text: string) => translate(locale, text);
  const choices = await orderFormOptions();

  return {
    options: {
      customers: choices.customers.map((customer) => ({ value: String(customer.id), label: customer.name })),
      branches: choices.branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
      products: choices.products.map((product) => ({ value: String(product.id), label: product.name })),
      fulfilments: Object.entries(optionsOf(FULFILMENTS)).map(([value, label]) => ({ value, label: t(label) })),
      paymentMethods: choices.paymentMethods.map((method) => ({ value: method, label: t(method) })),
    },
    labels: {
      heading: "",
      info: t("Informasi Pesanan"),
      itemsSection: t("Item Pesanan"),
      customer: t("Pelanggan"),
      branch: t("Cabang"),
      fulfilment: t("Cara Terima"),
      paymentMethod: t("Metode Pembayaran"),
      shippingTotal: t("Ongkos Kirim"),
      note: t("Catatan"),
      items: "Items",
      product: t("Produk"),
      quantity: t("Jumlah"),
      addItem: t("Tambah Item"),
      deleteItem: t("Hapus"),
      placeholder: t("Pilih salah satu opsi"),
      search: t("Ketik untuk mencari..."),
      noResults: t("Tidak ada opsi yang tersedia."),
      clear: "Clear selection",
      create: t("Buat"),
      createAnother: t("Buat & buat lainnya"),
      cancel: t("Batal"),
      save: t("Simpan"),
      close: t("Tutup"),
      sure: t("Apakah Anda yakin ingin melakukan ini?"),
    },
  };
}
