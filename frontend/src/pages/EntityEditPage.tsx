import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ENTITY_TYPES,
  KNOWLEDGE_STATES,
  type EntityData,
  type EntityInput,
  type Knowledge,
  type RecipeIngredient,
} from '@codex/shared'
import { motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import { LuCode, LuPenLine, LuSave, LuTrash2, LuTriangleAlert, LuX } from 'react-icons/lu'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import ImageUpload from '../components/ImageUpload'
import IngredientsEditor from '../components/IngredientsEditor'
import { Empty, Loading, PageHead } from '../components/bits'
import { Cta, ctaClass, Field, inputClass, textareaClass } from '../components/ui'
import { useIsDm } from '../lib/identity'
import { templateFor } from '../templates'

const RichEditor = lazy(() => import('../editor/RichEditor'))

type Draft = Required<Pick<EntityInput, 'type' | 'name' | 'knowledge'>> & {
  summary: string
  bodyMd: string
  tags: string
  imageKey: string | null
  data: EntityData
}

const BLANK = (type: string): Draft => ({
  type,
  name: '',
  summary: '',
  bodyMd: '',
  tags: '',
  imageKey: null,
  knowledge: 'unknown',
  data: {},
})

const KNOWLEDGE_HELP: Record<Knowledge, string> = {
  unknown: 'Unknown — hidden from players',
  rumoured: 'Rumoured — visible, flagged',
  known: 'Known — fully visible',
}

const LABEL = 'type-lab'

/** Handles both /new?type=npc and /e/:id/edit. */
export default function EntityEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isDm = useIsDm()
  const queryClient = useQueryClient()

  const existing = useQuery({
    queryKey: ['entity', id],
    queryFn: () => api.getEntity(id!),
    enabled: Boolean(id),
  })

  const [draft, setDraft] = useState<Draft>(() => BLANK(params.get('type') ?? 'npc'))
  const [error, setError] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState(false)

  useEffect(() => {
    const e = existing.data
    if (!e) return
    setDraft({
      type: e.type,
      name: e.name,
      summary: e.summary ?? '',
      bodyMd: e.bodyMd ?? '',
      tags: e.tags.join(', '),
      imageKey: e.imageKey,
      knowledge: e.knowledge,
      data: e.data,
    })
  }, [existing.data])

  const save = useMutation({
    mutationFn: (input: EntityInput) =>
      id ? api.updateEntity(id, input) : api.createEntity(input),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries()
      navigate(`/e/${saved.id}`, { replace: true })
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: () => api.deleteEntity(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      navigate('/party', { replace: true })
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!isDm) return <Empty>DM mode required</Empty>
  if (id && existing.isLoading) return <Loading />

  const template = templateFor(draft.type)

  function setData(key: string, value: unknown) {
    setDraft((d) => ({ ...d, data: { ...d.data, [key]: value } }))
  }

  const bodyTextarea = (
    <textarea
      className={textareaClass}
      rows={10}
      value={draft.bodyMd}
      placeholder={'Markdown. Link other entries with [[Their Name]].'}
      onChange={(e) => setDraft((d) => ({ ...d, bodyMd: e.target.value }))}
    />
  )

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    save.mutate({
      type: draft.type,
      name: draft.name,
      summary: draft.summary || null,
      bodyMd: draft.bodyMd || null,
      data: draft.data,
      imageKey: draft.imageKey,
      tags: draft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      knowledge: draft.knowledge,
    })
  }

  return (
    <>
      <PageHead>
        <h1 className="type-title m-0">
          {id ? `Edit ${template.label}` : `New ${template.label}`}
        </h1>
      </PageHead>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        {!id && (
          <Field label={<span className={LABEL}>Type</span>}>
            <select
              className={inputClass}
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value, data: {} }))}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {templateFor(type).label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={<span className={LABEL}>Name</span>}>
          <input
            className={inputClass}
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>

        <Field label={<span className={LABEL}>Summary</span>}>
          <input
            className={inputClass}
            value={draft.summary}
            placeholder="One line, shown under the name in lists"
            onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
          />
        </Field>

        <Field label={<span className={LABEL}>Knowledge</span>}>
          <select
            className={inputClass}
            value={draft.knowledge}
            onChange={(e) => setDraft((d) => ({ ...d, knowledge: e.target.value as Knowledge }))}
          >
            {KNOWLEDGE_STATES.map((state) => (
              <option key={state} value={state}>
                {KNOWLEDGE_HELP[state]}
              </option>
            ))}
          </select>
        </Field>

        <ImageUpload
          entityType={draft.type}
          imageUrl={existing.data?.imageUrl ?? null}
          onUploaded={(key) => setDraft((d) => ({ ...d, imageKey: key }))}
        />

        {draft.type === 'item' && (
          <div className="type-meta">
            This is the catalogue entry. Who carries it, and how many, is set from the Party and Me
            tabs.
          </div>
        )}

        {template.fields.map((field) =>
          field.kind === 'ingredients' ? (
            <IngredientsEditor
              key={field.key}
              value={(draft.data[field.key] as RecipeIngredient[]) ?? []}
              onChange={(next) => setData(field.key, next)}
            />
          ) : field.kind === 'boolean' ? (
            <label key={field.key} className="flex flex-row items-center gap-2.5">
              <input
                type="checkbox"
                checked={Boolean(draft.data[field.key])}
                onChange={(e) => setData(field.key, e.target.checked)}
              />
              <span className={LABEL}>{field.label}</span>
            </label>
          ) : (
            <Field key={field.key} label={<span className={LABEL}>{field.label}</span>}>
              <input
                className={inputClass}
                type={field.kind === 'number' ? 'number' : 'text'}
                placeholder={field.placeholder}
                value={String(draft.data[field.key] ?? '')}
                onChange={(e) =>
                  setData(
                    field.key,
                    field.kind === 'number'
                      ? e.target.value === ''
                        ? null
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            </Field>
          ),
        )}

        <Field label={<span className={LABEL}>Tags</span>}>
          <input
            className={inputClass}
            value={draft.tags}
            placeholder="comma, separated"
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
          />
        </Field>

        {/*
          Not a <Field>: that wraps its child in a <label>, and clicking a label
          does not reliably focus a contenteditable the way it focuses an input.
        */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={LABEL}>Body</span>
            <button
              type="button"
              className="type-meta flex cursor-pointer items-center gap-1 text-ink-faint"
              onClick={() => setSourceMode((on) => !on)}
            >
              {sourceMode ? <LuPenLine aria-hidden /> : <LuCode aria-hidden />}
              {sourceMode ? 'Rich text' : 'Markdown'}
            </button>
          </div>

          {sourceMode ? (
            bodyTextarea
          ) : (
            <Suspense fallback={bodyTextarea}>
              <RichEditor
                value={draft.bodyMd}
                onChange={(bodyMd) => setDraft((d) => ({ ...d, bodyMd }))}
                placeholder="Markdown. Type @ to link another entry."
                onUnrepresentable={() => setSourceMode(true)}
              />
            </Suspense>
          )}
        </div>

        {error && (
          <motion.div
            className="type-meta flex items-center gap-1.75 text-danger"
            animate={{ x: [0, -6, 6, -4, 4, 0] }}
            transition={{ duration: 0.35 }}
          >
            <LuTriangleAlert aria-hidden />
            {error}
          </motion.div>
        )}

        <Cta type="submit" disabled={save.isPending}>
          <LuSave aria-hidden />
          {save.isPending ? 'Saving…' : 'Save'}
        </Cta>
        <button type="button" className={ctaClass('ghost')} onClick={() => navigate(-1)}>
          <LuX aria-hidden />
          Cancel
        </button>
        {id && (
          <Cta
            tone="danger"
            type="button"
            onClick={() => {
              if (confirm(`Delete ${draft.name}? This cannot be undone.`)) remove.mutate()
            }}
          >
            <LuTrash2 aria-hidden />
            Delete
          </Cta>
        )}
      </form>
    </>
  )
}
