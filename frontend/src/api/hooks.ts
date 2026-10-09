import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { auth } from '../lib/storage'
import { request } from './client'
import type {
  AnalystAnswer,
  AnalystMode,
  AnswerKeyEntry,
  ArtifactContent,
  Catalog,
  CrisisBriefing,
  CrisisCandidate,
  CrisisResponse,
  DataRoomItem,
  DraftItem,
  DraftPreview,
  EditionInfo,
  EventView,
  FeedbackBody,
  OperatingModelDesign,
  Opportunity,
  OpportunityMap,
  PitchReview,
  PitchSubmission,
  Priority,
  Round2Action,
  Scorecard,
  ScoreboardEntry,
  SessionView,
  TeamView,
  Workspace,
  YearReport,
} from './types'

const teamToken = () => auth.team()?.token ?? null

export const keys = {
  catalog: ['catalog'] as const,
  team: ['team'] as const,
  dataroom: ['team', 'dataroom'] as const,
  artifact: (id: string) => ['team', 'artifact', id] as const,
  results: (year: number) => ['team', 'results', year] as const,
  crisis: ['team', 'crisis'] as const,
  scorecard: ['team', 'scorecard'] as const,
  session: (id: string) => ['session', id] as const,
  sessionPart: (id: string, part: string) => ['session', id, part] as const,
}

export function useCatalog() {
  return useQuery({
    queryKey: keys.catalog,
    queryFn: () => request<Catalog>('GET', '/catalog'),
    staleTime: Infinity,
  })
}

// ------------------------------------------------------------------ team

export function useTeam() {
  return useQuery({
    queryKey: keys.team,
    queryFn: () => request<TeamView>('GET', '/team', { token: teamToken() }),
    refetchInterval: 30_000,
  })
}

export function useDataRoom() {
  return useQuery({
    queryKey: keys.dataroom,
    queryFn: () => request<DataRoomItem[]>('GET', '/team/dataroom', { token: teamToken() }),
  })
}

export function useArtifact(id: string | null) {
  return useQuery({
    queryKey: keys.artifact(id ?? ''),
    queryFn: () => request<ArtifactContent>('GET', `/team/dataroom/${id}`, { token: teamToken() }),
    enabled: !!id,
    staleTime: Infinity,
  })
}

export function useResults(year: number, enabled: boolean) {
  return useQuery({
    queryKey: keys.results(year),
    queryFn: () => request<YearReport>('GET', `/team/results/${year}`, { token: teamToken() }),
    enabled,
  })
}

export function useCrisis(enabled: boolean) {
  return useQuery({
    queryKey: keys.crisis,
    queryFn: () => request<CrisisBriefing>('GET', '/team/crisis', { token: teamToken() }),
    enabled,
  })
}

export function useScorecard(enabled: boolean) {
  return useQuery({
    queryKey: keys.scorecard,
    queryFn: () => request<Scorecard>('GET', '/team/scorecard', { token: teamToken() }),
    enabled,
  })
}

function useTeamMutation<TVars, TOut>(
  fn: (vars: TVars) => Promise<TOut>,
  invalidate: QueryKey[] = [keys.team],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  })
}

export const useSavePriorities = () =>
  useTeamMutation((priorities: Priority[]) =>
    request<Workspace>('PUT', '/team/priorities', { token: teamToken(), body: { priorities } }),
  )

export const useSaveRound1 = () =>
  useTeamMutation((body: { items: DraftItem[]; thesis: string }) =>
    request<DraftPreview>('PUT', '/team/round1', { token: teamToken(), body }),
  )

export const useSubmitRound1 = () =>
  useTeamMutation(() => request<TeamView>('POST', '/team/round1/submit', { token: teamToken() }))

export const useSavePitch = () =>
  useTeamMutation((body: { pitch: PitchSubmission; submit: boolean }) =>
    request<PitchReview>('PUT', '/team/pitch', { token: teamToken(), body }),
  )

export const useSaveRound2 = () =>
  useTeamMutation((body: { actions: Round2Action[]; thesis: string }) =>
    request<DraftPreview>('PUT', '/team/round2', { token: teamToken(), body }),
  )

export const useSubmitRound2 = () =>
  useTeamMutation(() => request<TeamView>('POST', '/team/round2/submit', { token: teamToken() }))

export const useSaveOpModel = () =>
  useTeamMutation((body: { design: OperatingModelDesign; submit: boolean }) =>
    request<Workspace>('PUT', '/team/operating-model', { token: teamToken(), body }),
  )

export const useRespondCrisis = () =>
  useTeamMutation(
    (body: CrisisResponse) =>
      request<CrisisBriefing>('POST', '/team/crisis/response', { token: teamToken(), body }),
    [keys.team, keys.crisis],
  )

export const useSaveOpportunities = () =>
  useTeamMutation((body: { items: Opportunity[]; consent?: Workspace['consent'] }) =>
    request<Workspace>('PUT', '/team/opportunities', { token: teamToken(), body }),
  )

export const useSubmitFeedback = () =>
  useTeamMutation((body: FeedbackBody) =>
    request<Workspace>('POST', '/team/feedback', { token: teamToken(), body }),
  )

export const useAskAnalyst = () =>
  useMutation({
    mutationFn: (body: { question: string; mode: AnalystMode; context?: string }) =>
      request<AnalystAnswer>('POST', '/team/ai/ask', { token: teamToken(), body }),
  })

// ------------------------------------------------------------------ facilitator

export function useSession(id: string, token: string | null) {
  return useQuery({
    queryKey: keys.session(id),
    queryFn: () => request<SessionView>('GET', `/sessions/${id}`, { token }),
    enabled: !!token,
    refetchInterval: 20_000,
  })
}

export function useSessionPart<T>(id: string, token: string | null, part: string, enabled = true) {
  return useQuery({
    queryKey: keys.sessionPart(id, part),
    queryFn: () => request<T>('GET', `/sessions/${id}/${part}`, { token }),
    enabled: !!token && enabled,
  })
}

export const useScoreboard = (id: string, token: string | null, enabled: boolean) =>
  useSessionPart<ScoreboardEntry[]>(id, token, 'scoreboard', enabled)
export const useAnswerKey = (id: string, token: string | null) =>
  useSessionPart<AnswerKeyEntry[]>(id, token, 'answer-key')
export const useOpportunityMap = (id: string, token: string | null, enabled: boolean) =>
  useSessionPart<OpportunityMap>(id, token, 'opportunity-map', enabled)
export const useEvents = (id: string, token: string | null) =>
  useSessionPart<EventView[]>(id, token, 'events')
export const useEdition = (id: string, token: string | null) =>
  useSessionPart<EditionInfo>(id, token, 'edition')
export const usePitchReview = (
  id: string,
  token: string | null,
  teamId: string,
  enabled: boolean,
) => useSessionPart<PitchReview>(id, token, `teams/${teamId}/pitch`, enabled)
export const useCrisisCandidates = (id: string, token: string | null, enabled: boolean) =>
  useSessionPart<Record<string, CrisisCandidate[]>>(id, token, 'crisis/candidates', enabled)

export function useFacilitatorAction<TBody>(sessionId: string, token: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      path,
      body,
      method = 'POST',
    }: {
      path: string
      body?: TBody
      method?: 'POST' | 'PUT'
    }) =>
      request<SessionView | undefined>(method, `/sessions/${sessionId}${path}`, { token, body }),
    onSuccess: (data) => {
      if (data) qc.setQueryData(keys.session(sessionId), data)
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}
