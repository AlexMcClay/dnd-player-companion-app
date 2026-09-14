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
import { useEffect, useState } from 'react'
import { LuSave, LuTrash2, LuTriangleAlert, LuX } from 'react-icons/lu'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import ImageUpload from '../components/ImageUpload'
import IngredientsEditor from '../components/IngredientsEditor'
import { Empty, Loading } from '../components/bits'
import { useIsDm } from '../lib/dm'
import { SPRING } from '../lib/motion'
import { templateFor } from '../templates'

type Draft = Required<Pick<EntityInput, 'type' | 'name' | 'knowledge' | 'quantity'>> & {
  summary: string
  bodyMd: string
  tags: string
  imageKey: string | null
  ownerId: string | null
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
  ownerId: null,
  quantity: 1,
  data: {},
})

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

  const players = useQuery({
    queryKey: ['entities', { type: 'player' }],
    queryFn: () => api.listEntities({ type: 'player' }),
  })

  const [draft, setDraft] = useState<Draft>(() => BLANK(params.get('type') ?? 'npc'))
  const [error, setError] = useState<string | null>(null)

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
      ownerId: e.ownerId,
      quantity: e.quantity,
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
      ownerId: draft.ownerId,
      quantity: draft.quantity,
    })
  }

  return (
    <>
      <div className="head">
        <h1 className="ttl">{id ? `Edit ${template.label}` : `New ${template.label}`}</h1>
      </div>

      <form className="stack gap-16" onSubmit={submit}>
        {!id && (
          <label className="field">
            <span className="lab">Type</span>
            <select
              className="input"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value, data: {} }))}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {templateFor(type).label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span className="lab">Name</span>
          <input
            className="input"
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="lab">Summary</span>
          <input
            className="input"
            value={draft.summary}
            placeholder="One line, shown under the name in lists"
            onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="lab">Knowledge</span>
          <select
            className="input"
            value={draft.knowledge}
            onChange={(e) =>
              setDraft((d) => ({ ...d, knowledge: e.target.value as Knowledge }))
            }
          >
            {KNOWLEDGE_STATES.map((state) => (
              <option key={state} value={state}>
                {state === 'unknown'
                  ? 'Unknown — hidden from players'
                  : state === 'rumoured'
                    ? 'Rumoured — visible, flagged'
                    : 'Known — fully visible'}
              </option>
            ))}
          </select>
        </label>

        <ImageUpload
          entityType={draft.type}
          imageUrl={existing.data?.imageUrl ?? null}
          onUploaded={(key) => setDraft((d) => ({ ...d, imageKey: key }))}
        />

        {template.ownable && (
          <>
            <label className="field">
              <span className="lab">Carried by</span>
              <select
                className="input"
                value={draft.ownerId ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value || null }))}
              >
                <option value="">Party stash</option>
                {players.data?.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="lab">Quantity</span>
              <input
                className="input"
                type="number"
                min={0}
                value={draft.quantity}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, quantity: Number(e.target.value) || 0 }))
                }
              />
            </label>
          </>
        )}

        {template.fields.map((field) =>
          field.kind === 'ingredients' ? (
            <IngredientsEditor
              key={field.key}
              value={(draft.data[field.key] as RecipeIngredient[]) ?? []}
              onChange={(next) => setData(field.key, next)}
            />
          ) : field.kind === 'boolean' ? (
            <label
              key={field.key}
              className="field"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <input
                type="checkbox"
                checked={Boolean(draft.data[field.key])}
                onChange={(e) => setData(field.key, e.target.checked)}
              />
              <span className="lab">{field.label}</span>
            </label>
          ) : (
            <label key={field.key} className="field">
              <span className="lab">{field.label}</span>
              <input
                className="input"
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
            </label>
          ),
        )}

        <label className="field">
          <span className="lab">Tags</span>
          <input
            className="input"
            value={draft.tags}
            placeholder="comma, separated"
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="lab">Body</span>
          <textarea
            className="input"
            rows={10}
            value={draft.bodyMd}
            placeholder={'Markdown. Link other entries with [[Their Name]].'}
            onChange={(e) => setDraft((d) => ({ ...d, bodyMd: e.target.value }))}
          />
        </label>

        {error && (
          <motion.div
            className="meta with-icon"
            style={{ color: '#d89494' }}
            animate={{ x: [0, -6, 6, -4, 4, 0] }}
            transition={{ duration: 0.35 }}
          >
            <LuTriangleAlert aria-hidden />
            {error}
          </motion.div>
        )}

        <motion.button
          type="submit"
          className="cta with-icon"
          disabled={save.isPending}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
        >
          <LuSave aria-hidden />
          {save.isPending ? 'Saving…' : 'Save'}
        </motion.button>
        <button type="button" className="cta cta-ghost with-icon" onClick={() => navigate(-1)}>
          <LuX aria-hidden />
          Cancel
        </button>
        {id && (
          <motion.button
            type="button"
            className="cta cta-danger with-icon"
            onClick={() => {
              if (confirm(`Delete ${draft.name}? This cannot be undone.`)) remove.mutate()
            }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
          >
            <LuTrash2 aria-hidden />
            Delete
          </motion.button>
        )}
      </form>
    </>
  )
}
