import ProductCell from './ProductCell';

/**
 * Desktop product table: six cells per row sharing their borders.
 */
export default function ProductGrid({ products }: { products: ProductTile[] }) {
    return (
        <div className="grid grid-cols-6 border-l border-t border-line bg-white">
            {products.map((product) => (
                <ProductCell key={product.id} product={product} />
            ))}
        </div>
    );
}
