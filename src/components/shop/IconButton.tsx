import Icon, { type IconName } from './Icon';

/**
 * Tappable header action that runs a handler rather than navigating.
 *
 * The button twin of `IconLink`, used for the search toggle.
 */
export default function IconButton({ name, onClick, label }: { name: IconName, onClick: () => void, label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex items-center"
        >
            <Icon name={name} size={20} />
        </button>
    );
}
