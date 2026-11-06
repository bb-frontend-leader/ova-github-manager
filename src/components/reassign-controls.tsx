'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** Casilla que marca o desmarca todas las OVAs de un desarrollador (las de su <details>). */
export function CheckAll({ label }: { label: string }) {
  return (
    <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-primary)]"
        onChange={(event) => {
          const group = event.currentTarget.closest('details');
          const checked = event.currentTarget.checked;
          group?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => {
            box.checked = checked;
          });
          // El formulario no se entera de los cambios hechos por código: se le avisa
          event.currentTarget.form?.dispatchEvent(new Event('change', { bubbles: true }));
        }}
      />
      {label}
    </label>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      <ArrowRightLeft aria-hidden /> {pending ? 'Reasignando…' : 'Reasignar'}
    </Button>
  );
}

/**
 * Barra fija con el destino de la reasignación. Cuenta las OVAs marcadas en el formulario que la
 * contiene. Sin JavaScript sigue funcionando: el botón queda activo y el servidor avisa si no hay ninguna.
 */
export function ReassignBar({
  developers,
}: {
  /** Con cuántas OVAs activas cuenta cada uno, para elegir a quién pasar trabajo */
  developers: { id: number; name: string; active: number }[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!form) return;
    const count = () => setSelected(form.querySelectorAll('input[name="ids"]:checked').length);
    count();
    form.addEventListener('change', count);
    return () => form.removeEventListener('change', count);
  }, [form]);

  return (
    <div
      ref={(element) => setForm(element?.closest('form') ?? null)}
      className="sticky bottom-4 z-10 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-lg"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="developerId">Pasar las OVAs marcadas a</Label>
        <NativeSelect id="developerId" name="developerId" defaultValue="" required>
          <option value="" disabled>
            Elige una persona
          </option>
          {developers.map((developer) => (
            <option key={developer.id} value={developer.id}>
              {developer.name} · {developer.active} {developer.active === 1 ? 'activa' : 'activas'}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton disabled={selected === 0} />
      <p role="status" className="basis-full text-xs text-muted-foreground sm:basis-auto sm:pb-2">
        {selected === null
          ? 'Marca las OVAs que quieras pasar.'
          : selected === 0
            ? 'Todavía no marcaste ninguna OVA.'
            : `${selected} ${selected === 1 ? 'OVA marcada' : 'OVAs marcadas'}.`}
      </p>
    </div>
  );
}
