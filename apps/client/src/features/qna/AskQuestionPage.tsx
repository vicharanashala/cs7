// Ask a Question — multi-step flow per Change Spec §6.
//
// Flow:
//   1. WRITE     → student fills title/description/category (+optional screenshot URL).
//   2. CHECK FAQ → server returns up to 5 matching FAQs. User picks "yes, this answers it" or "none of these".
//   3. CHECK Q   → if no FAQ matched, server returns up to 2 matching open community questions.
//                  User picks "same query" (server tags them onto the existing question) or "different query".
//   4. SUBMIT    → user picks visibility (personal | community) and posts.
//
// The signed `existingAnswerCheckToken` returned from step 2 is required for both
// `tagMe` (step 3) and `createQuestion` (step 4) — proving the user saw suggestions.
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, HelpCircle, ImagePlus, X } from 'lucide-react';
import { z } from 'zod';
import type { ExistingAnswerCheckResult, QuestionType } from '@samagama/shared';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useCategories } from '../faq/queries';
import { qnaApi } from './api';
import { qnaKeys } from './queries';

// Step 1 form. Local schema (not in shared) because this is a UI-only intermediate state.
const draftSchema = z.object({
  description: z.string().trim().min(8, 'Description must be at least 8 characters').max(4000),
  category: z.string().min(1, 'Pick a category'),
});

type Draft = z.infer<typeof draftSchema>;
type Step = 'write' | 'faq-match' | 'question-match' | 'submit' | 'done';

export function AskQuestionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('write');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [check, setCheck] = useState<ExistingAnswerCheckResult | null>(null);
  const [type, setType] = useState<QuestionType>('community');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useCategories();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Draft>({ resolver: zodResolver(draftSchema) });

  const checkMutation = useMutation({
    mutationFn: (input: Draft) =>
      qnaApi.checkExisting({
        title: deriveTitle(input.description),
        description: input.description,
        category: input.category,
      }),
    onSuccess: (result) => {
      setCheck(result);
      if (result.matchedFaqs.length > 0) setStep('faq-match');
      else if (result.matchedQuestions.length > 0) setStep('question-match');
      else setStep('submit');
    },
  });

  const tagMeMutation = useMutation({
    mutationFn: (questionId: string) => {
      if (!check) throw new Error('No check token');
      return qnaApi.tagMe(questionId, check.token);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.questions({ type: 'community', mine: true }) });
      setStep('done');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !check) throw new Error('Draft missing');
      let screenshotUrl: string | undefined;
      if (photoFile) {
        screenshotUrl = await readFileAsDataUrl(photoFile);
      }
      return qnaApi.createQuestion({
        title: deriveTitle(draft.description),
        description: draft.description,
        category: draft.category,
        tags: [],
        type,
        screenshotUrl,
        existingAnswerCheckToken: check.token,
      });
    },
    onSuccess: () => {
      setStep('done');
      // Refresh the student dashboard cards (Questions asked / Pending) right away.
      void qc.invalidateQueries({ queryKey: ['stats', 'student-dashboard'] });
      void qc.invalidateQueries({ queryKey: qnaKeys.all });
    },
  });

  const onWrite = handleSubmit((values) => {
    setDraft(values);
    checkMutation.mutate(values);
  });

  const onFaqDoesntAnswer = () => {
    if (check && check.matchedQuestions.length > 0) setStep('question-match');
    else setStep('submit');
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(124,58,237,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HelpCircle size={18} color="var(--color-purple)" />
        </div>
        <div>
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Ask a Question
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 10 }}>
            We'll check existing answers before posting
          </span>
        </div>
      </div>

      <StepIndicator current={step} />

      {step === 'write' && (
        <div className="mod-card mod-card-purple">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 0' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--color-purple-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HelpCircle size={17} color="var(--color-purple)" />
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}
            >
              Describe your question
            </span>
          </div>
          <div style={{ padding: '14px 20px 20px' }}>
            <form onSubmit={onWrite}>
              <FormField label="Description *" error={errors.description?.message}>
                <textarea
                  rows={5}
                  {...register('description')}
                  placeholder="Describe your issue in detail. Include any error messages or steps you've tried."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </FormField>

              <FormField label="Category *" error={errors.category?.message}>
                <select {...register('category')} style={inputStyle} defaultValue="">
                  <option value="" disabled>
                    Select a category
                  </option>
                  {categories?.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Screenshot (optional)">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                    setPhotoPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {photoPreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={photoPreview}
                      alt="Screenshot preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        borderRadius: 8,
                        display: 'block',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      border: '1px dashed var(--color-border)',
                      borderRadius: 8,
                      background: 'var(--color-input)',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'inherit',
                    }}
                  >
                    <ImagePlus size={16} /> Upload photo
                  </button>
                )}
              </FormField>

              {checkMutation.isError && (
                <ErrorBanner>
                  {checkMutation.error instanceof Error
                    ? checkMutation.error.message
                    : 'Could not run existing-answer check'}
                </ErrorBanner>
              )}

              <Button type="submit" disabled={isSubmitting || checkMutation.isPending}>
                {checkMutation.isPending ? 'Checking…' : 'Check Existing Answers'}{' '}
                <ChevronRight size={14} />
              </Button>
            </form>
          </div>
        </div>
      )}

      {step === 'faq-match' && check && (
        <div>
          <Banner color="warning" icon={<AlertTriangle size={18} />}>
            <strong>
              We found {Math.min(check.matchedFaqs.length, 3)} possibly related FAQ(s).
            </strong>{' '}
            Check if any of these answers your question.
          </Banner>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {check.matchedFaqs.slice(0, 3).map((faq) => (
              <div
                key={faq.id}
                className="mod-card mod-card-orange"
                style={{ padding: '16px 18px' }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{faq.title}</div>
                {faq.summary && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    {faq.summary}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    background: 'var(--color-input)',
                    padding: 10,
                    borderRadius: 8,
                    borderLeft: '3px solid var(--color-primary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {faq.answer}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setStep('write')}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← Edit Question
            </button>
            <button
              type="button"
              onClick={onFaqDoesntAnswer}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-pill)',
                color: 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              None of these – Continue
            </button>
            <button
              type="button"
              onClick={() => navigate('/faqs')}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#16a34a',
                color: 'white',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 3px 10px rgba(22,163,74,0.3)',
              }}
            >
              ✓ This answers it
            </button>
          </div>
        </div>
      )}

      {step === 'question-match' && check && (
        <div>
          <Banner color="accent" icon={<AlertTriangle size={18} />}>
            <strong>{check.matchedQuestions.length} similar open question(s) found.</strong> Tagging
            yourself adds you to the watcher list.
          </Banner>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {check.matchedQuestions.map((q) => (
              <div key={q.id} className="mod-card mod-card-blue" style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    marginBottom: 10,
                    color: 'var(--color-text)',
                  }}
                >
                  {!q.description ||
                  q.description.trim() === '' ||
                  q.description.trim().toLowerCase() === q.title.trim().toLowerCase()
                    ? q.title
                    : q.description.length > 200
                      ? q.description.slice(0, 200) + '…'
                      : q.description}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge color="accent">{q.answerCount} answers</Badge>
                  <Button
                    size="sm"
                    onClick={() => tagMeMutation.mutate(q.id)}
                    disabled={tagMeMutation.isPending}
                  >
                    Same query — tag me
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={() => setStep('write')}>
              ← Edit question
            </Button>
            <Button onClick={() => setStep('submit')}>
              Different query — submit new <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {step === 'submit' && (
        <div className="mod-card mod-card-purple" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            How should we post this?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <RadioOption
              checked={type === 'community'}
              onChange={() => setType('community')}
              label="Community"
              description="Visible to everyone — peers can answer."
            />
            <RadioOption
              checked={type === 'personal'}
              onChange={() => setType('personal')}
              label="Personal"
              description="Visible only to you and moderators."
            />
          </div>

          {createMutation.isError && (
            <ErrorBanner>
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Could not submit question'}
            </ErrorBanner>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={() => setStep('write')}>
              ← Edit question
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting…' : 'Submit question'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="mod-card mod-card-green" style={{ padding: 40, textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 28,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {tagMeMutation.isSuccess ? "You've been tagged" : 'Question submitted'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>
            {tagMeMutation.isSuccess
              ? "We'll notify you when there's a new answer."
              : 'Track its progress in My Questions.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="ghost" onClick={() => navigate('/community')}>
              Browse community
            </Button>
            <Button onClick={() => navigate('/my-questions')}>Go to My Questions</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string; num: number }[] = [
    { key: 'write', label: 'Write', num: 1 },
    { key: 'faq-match', label: 'Check FAQ', num: 2 },
    { key: 'question-match', label: 'Check Community', num: 3 },
    { key: 'submit', label: 'Submit', num: 4 },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 22 }}>
      {steps.map((s, i) => {
        const isCurrent = current === s.key;
        const isPast = i < currentIdx || current === 'done';
        const dotColor = isCurrent
          ? 'var(--color-purple)'
          : isPast
            ? 'var(--color-success)'
            : 'var(--color-border)';
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: dotColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  color: isCurrent || isPast ? 'white' : 'var(--color-text-muted)',
                  transition: 'all 0.2s',
                  boxShadow: isCurrent ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
                }}
              >
                {isPast && !isCurrent ? '✓' : s.num}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent
                    ? 'var(--color-purple)'
                    : isPast
                      ? 'var(--color-success)'
                      : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isPast ? 'var(--color-success)' : 'var(--color-border)',
                  marginBottom: 14,
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          display: 'block',
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{hint}</div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        background: checked ? 'var(--color-primary-bg)' : 'var(--color-input)',
        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{description}</div>
      </div>
    </label>
  );
}

function Banner({
  children,
  color,
  icon,
}: {
  children: React.ReactNode;
  color: 'warning' | 'accent';
  icon: React.ReactNode;
}) {
  const bg = color === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-primary-bg)';
  const fg = color === 'warning' ? 'var(--color-warning)' : 'var(--color-primary-text)';
  return (
    <div
      role="status"
      style={{
        background: bg,
        border: `1px solid ${fg}40`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ color: fg, flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{children}</div>
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 12,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function deriveTitle(description: string): string {
  const first = description.trim().split('\n')[0].trim();
  return first.length > 140 ? first.slice(0, 137) + '…' : first;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-input)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 10,
  padding: '12px 14px',
  color: 'var(--color-text)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
