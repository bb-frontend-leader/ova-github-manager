'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Copia al portapapeles. `navigator.clipboard` solo existe en contextos seguros (HTTPS o
 * localhost); si la herramienta se abre por IP en un servidor propio con http, cae al método
 * antiguo con un <textarea> temporal.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permiso denegado: se prueba el método alternativo
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

type Status = 'idle' | 'copied' | 'error';

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    const ok = await copyToClipboard(text);
    setStatus(ok ? 'copied' : 'error');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  }

  return (
    <>
      {/* type="button": dentro de un <form> no debe enviarlo */}
      <Button type="button" variant="outline" size="sm" onClick={handleClick}>
        {status === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
        {status === 'copied' ? 'Copiado' : status === 'error' ? 'No se pudo copiar' : label}
      </Button>
      <span role="status" className="sr-only">
        {status === 'copied' ? 'Copiado al portapapeles' : ''}
      </span>
    </>
  );
}
