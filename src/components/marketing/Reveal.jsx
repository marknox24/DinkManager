import useReveal from '../../hooks/useReveal';

// Thin wrapper around useReveal for markup call sites — see index.css for
// the [data-reveal] transition itself.
export default function Reveal({ as: Tag = 'div', direction, delay = 0, className = '', children, ...rest }) {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      data-reveal={direction || 'up'}
      data-visible={visible}
      style={{ '--reveal-delay': `${delay}ms` }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}
