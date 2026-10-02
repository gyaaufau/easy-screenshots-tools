import { useState, type ReactNode } from 'react';
export function ControlSection({number, title, children, defaultOpen = false}: {number: number; title: string; children: ReactNode; defaultOpen?: boolean}) {
 const [expanded, setExpanded] = useState(defaultOpen);
 const id = 'control-panel-' + number;
 return <section className="step"><button type="button" className="step-title" aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span className="num">{number}</span> {title}</button><div className="step-body" id={id} hidden={!expanded}>{children}</div></section>;
}
