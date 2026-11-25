import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { Text } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { DEFAULT_NEWS_TOPICS, NEWS_TOPICS } from "@/features/news/catalog";
import { getNewsInterests, getSavedNews, FREE_RADAR, RADAR_WEEK_MS, RadarLimitError, remainingChanges, setNewsInterests, setSavedNews } from "@/features/news/newsPreferences";
import { shouldShowRadarLaunch } from "@/features/news/radarLaunch";
import { useBalancePro } from "@/features/pro/BalanceProProvider";
import { getInstrument, INSTRUMENT_CATALOG, INSTRUMENT_GROUPS, marketLabel, searchInstruments, type InstrumentGroup, type NewsInstrument } from "@/features/news/instrumentCatalog";
import { instrumentBrandPaths } from "@/features/news/instrumentBrandPaths";
import { countNewsByTopic, filterNewsByTopic, type NewsTopicFilter } from "@/features/news/newsFilters";
import { loadInstrumentNews, loadNewsFeed } from "@/features/news/newsService";
import { copySavedNewsImage, discardSavedNewsImage, savedNewsImageUri } from "@/features/news/savedNewsMedia";
import { excludeBriefingStories, selectNewsBriefing } from "@/features/news/newsBriefing";
import type { NewsFeedResult, NewsItem, NewsTopicId } from "@/features/news/types";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { GlassCardContainer } from "@/ui/components/EntriesUI";
import BottomSheet from "@/ui/components/BottomSheet";
import NewsBriefing from "@/ui/components/NewsBriefing";
import NewsStoryCard from "@/ui/components/NewsStoryCard";
import NewsArtwork from "@/ui/components/NewsArtwork";
import HeaderAction from "@/components/header/HeaderAction";
import NewsMarketCard from "@/ui/components/NewsMarketCard";
import RadarLaunch from "@/ui/components/RadarLaunch";

const FILTER_FEEDBACK_MS = 180;
const FILTER_SCROLL_TIMEOUT_MS = 700;
const CATALOG_PAGE_SIZE = 20;
const FEATURED_INSTRUMENTS = INSTRUMENT_CATALOG.filter((item) => item.featured);

const topicDefaults: Record<NewsTopicId, string> = {
  markets: "Mercati",
  rates: "Tassi e inflazione",
  investing: "Investimenti",
  "personal-finance": "Finanza personale",
  pensions: "Previdenza",
  crypto: "Crypto",
  "real-estate": "Immobiliare",
  taxes: "Fisco",
};

export default function NewsScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [entryPhase, setEntryPhase] = useState<"checking" | "setup" | "launch" | "feed">("checking");
  const finishIntro = useCallback(() => setEntryPhase("feed"), []);
  const showingIntro = entryPhase === "launch";
  const { isPro, isReady } = useBalancePro();
  const [history, setHistory] = useState({ topics: [] as number[], instruments: [] as number[] });
  const [, updateClock] = useState(0);
  const remaining = remainingChanges(history);
  useEffect(() => {
    const now = Date.now();
    const next = [...history.topics, ...history.instruments].map((date) => date + RADAR_WEEK_MS).filter((date) => date > now);
    if (!next.length) return;
    const timer = setTimeout(() => updateClock((tick) => tick + 1), Math.min(...next) - now + 1);
    return () => clearTimeout(timer);
  }, [history, remaining.topics, remaining.instruments]);
  const firstSetup = entryPhase === "setup";
  const [topics, setTopics] = useState<NewsTopicId[]>([]);
  const [draftTopics, setDraftTopics] = useState<NewsTopicId[]>([]);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRequest = useRef(0);
  const [feedMode, setFeedMode] = useState<NewsFeedResult["mode"]>("preview");
  const [feedStale, setFeedStale] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<NewsFeedResult["fallbackReason"]>("not-configured");
  const [configVisible, setConfigVisible] = useState(false);
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(() => new Set());
  const [activeTopic, setActiveTopic] = useState<NewsTopicFilter>("all");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [draftInstruments, setDraftInstruments] = useState<string[]>([]);
  const [instrumentGroup, setInstrumentGroup] = useState<InstrumentGroup | "all">("all");
  const [instrumentQuery, setInstrumentQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(CATALOG_PAGE_SIZE);
  const searching = instrumentQuery.trim().length > 0;
  const searchResults = useMemo(() => searchInstruments(instrumentQuery, instrumentGroup), [instrumentQuery, instrumentGroup]);
  const featured = INSTRUMENT_GROUPS
    .filter((group) => instrumentGroup === "all" || instrumentGroup === group)
    .flatMap((group) => FEATURED_INSTRUMENTS
      .filter((item) => item.group === group && !draftInstruments.includes(item.id))
      .slice(0, instrumentGroup === "all" ? 3 : undefined));
  const [activeInstrument, setActiveInstrument] = useState<string>();
  const [instrumentRefresh, setInstrumentRefresh] = useState(0);
  const [instrumentResult, setInstrumentResult] = useState<{ query: string; items: NewsItem[]; error?: boolean; stale?: boolean }>();
  const savingInterests = useRef(false);
  const [savingChoices, setSavingChoices] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedItems, setSavedItems] = useState<NewsItem[] | null>(null);
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const saving = useRef(false);
  const savedRevision = useRef(0);
  const feedScroll = useRef<ScrollView>(null);
  const feedOffset = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [filterChanging, setFilterChanging] = useState(false);
  const filterTransition = useRef<{ apply: () => void; startedAt: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      listener.remove();
      if (filterTransition.current) clearTimeout(filterTransition.current.timer);
    };
  }, []);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    day: "numeric",
    month: "short",
  }), [i18n.resolvedLanguage]);

  const readBookmarks = useCallback(async () => {
    const revision = savedRevision.current;
    try {
      const bookmarks = await getSavedNews();
      if (savedRevision.current === revision) setSavedItems(bookmarks);
    } catch {
      if (savedRevision.current === revision) setSavedItems(null);
    }
  }, []);

  useEffect(() => { void readBookmarks(); }, [readBookmarks]);

  const toggleBookmark = async (item: NewsItem) => {
    if (saving.current) return;
    saving.current = true;
    savedRevision.current += 1;
    setPendingSave(item.url);
    let newImage: string | undefined;
    try {
      const bookmarks = await getSavedNews();
      const existing = bookmarks.find((bookmark) => bookmark.url === item.url);
      if (!existing) newImage = await copySavedNewsImage(item);
      const next = existing ? bookmarks.filter((bookmark) => bookmark.url !== item.url)
        : [{ ...item, imageUrl: undefined, savedImageFile: newImage }, ...bookmarks];
      await setSavedNews(next);
      setSavedItems(next);
      if (existing) discardSavedNewsImage(existing.savedImageFile);
    } catch {
      discardSavedNewsImage(newImage);
      Alert.alert(t("news.saved.error"));
    } finally {
      saving.current = false;
      setPendingSave(null);
    }
  };

  const topicLabel = useCallback(
    (id: NewsTopicId) => t(`news.topics.${id}`, { defaultValue: topicDefaults[id] }),
    [t]
  );

  const refresh = useCallback(async (nextTopics: NewsTopicId[]) => {
    const request = ++feedRequest.current;
    setLoading(true);
    try {
      const result = await loadNewsFeed(nextTopics);
      if (request !== feedRequest.current) return;
      setItems(result.items);
      setFeedMode(result.mode);
      setFeedStale(Boolean(result.stale));
      setNextCursor(result.nextCursor);
      setFallbackReason(result.fallbackReason);
    } finally {
      if (request === feedRequest.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadNewsFeed(topics, nextCursor);
      setItems((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !ids.has(item.id))];
      });
      setNextCursor(result.nextCursor);
    } catch {
      Alert.alert(
        t("news.loadMoreErrorTitle", { defaultValue: "Impossibile caricare altre notizie" }),
        t("news.loadMoreErrorBody", { defaultValue: "Controlla la connessione e riprova." })
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, t, topics]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);

    async function prepareFeed() {
      if (!isReady) return;
      const preferences = await getNewsInterests(isPro).catch(() => null);
      if (!active) return;
      const preferredTopics = preferences?.topics ?? DEFAULT_NEWS_TOPICS.slice(0, isPro ? undefined : FREE_RADAR.topics);
      setConfigVisible(false);
      setActiveInstrument((id) => id && preferences?.instruments.includes(id) ? id : undefined);
      setActiveTopic((id) => id === "all" || preferredTopics.includes(id) ? id : "all");
      if (preferences) setHistory(preferences.history);
      if (preferences && !preferences.configured) {
        setDraftTopics(preferredTopics);
        setDraftInstruments(preferences.instruments);
        setInstrumentGroup("all");
        setInstrumentQuery("");
        setSearchLimit(CATALOG_PAGE_SIZE);
        setEntryPhase("setup");
        return;
      }
      setTopics(preferredTopics);
      setInstruments(preferences?.instruments ?? []);
      const showLaunch = await shouldShowRadarLaunch(() => active);
      if (!active) return;
      setEntryPhase(showLaunch ? "launch" : "feed");
      await refresh(preferredTopics);
    }

    void prepareFeed();
    return () => {
      active = false;
      feedRequest.current += 1;
      setEntryPhase("checking");
    };
  }, [refresh, isReady, isPro]));

  useEffect(() => {
    if (!activeInstrument) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 16_000);
    loadInstrumentNews(activeInstrument, controller.signal)
      .then((results) => {
        if (active) setInstrumentResult({ query: activeInstrument, ...results });
      })
      .catch(() => {
        if (active) setInstrumentResult({ query: activeInstrument, items: [], error: true });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [activeInstrument, instrumentRefresh]);

  const instrumentView = activeInstrument && instrumentResult?.query === activeInstrument ? instrumentResult : undefined;
  const viewLoading = activeInstrument ? !instrumentView : loading;
  const refreshView = () => {
    if (!activeInstrument) return void refresh(topics);
    setInstrumentResult(undefined);
    setInstrumentRefresh((current) => current + 1);
  };

  const visibleTopicIds = useMemo(
    () => NEWS_TOPICS.filter((topic) => topics.includes(topic.id)),
    [topics]
  );
  const topicCounts = useMemo(() => countNewsByTopic(items), [items]);
  const filteredItems = useMemo(
    () => activeInstrument ? instrumentView?.items ?? [] : filterNewsByTopic(items, activeTopic),
    [activeInstrument, activeTopic, instrumentView, items]
  );
  const savedUrls = useMemo(() => new Set(savedItems?.map((item) => item.url)), [savedItems]);
  const showLoadMore = !showSaved && !activeInstrument && !loading && filteredItems.length > 0 && Boolean(nextCursor);
  const instrument = activeInstrument ? getInstrument(activeInstrument) : undefined;
  const activeTopicLabel = instrument?.name ?? (activeTopic === "all" ? null : topicLabel(activeTopic));
  const allSelected = activeTopic === "all" && !activeInstrument;
  const briefing = useMemo(
    () => showSaved || activeInstrument || loading || feedMode !== "live"
      ? []
      : selectNewsBriefing(filteredItems.slice(0, 10), activeTopic === "all" ? topics : [activeTopic]),
    [activeInstrument, activeTopic, feedMode, filteredItems, loading, showSaved, topics]
  );
  const displayedItems = showSaved ? savedItems ?? [] : excludeBriefingStories(filteredItems, briefing);
  const showListHeader = !briefing.length || displayedItems.length > 0;

  const renderBookmark = (item: NewsItem) => {
    const bookmarked = savedUrls.has(item.url);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: bookmarked, disabled: pendingSave !== null, busy: pendingSave === item.url }}
        accessibilityLabel={t(bookmarked ? "news.saved.remove" : "news.saved.add", { title: item.title })}
        onPress={() => void toggleBookmark(item)}
        disabled={pendingSave !== null}
        style={styles.iconButton}
      >
        <MaterialCommunityIcons name={bookmarked ? "bookmark" : "bookmark-outline"} size={22} color={bookmarked ? tokens.colors.accent : tokens.colors.muted} />
      </Pressable>
    );
  };

  const finishFilter = () => {
    const pending = filterTransition.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    filterTransition.current = null;
    setFilterChanging(false);
    pending.apply();
  };

  const switchFilter = (apply: () => void) => {
    if (filterTransition.current) clearTimeout(filterTransition.current.timer);
    const needsScroll = feedOffset.current > 1;
    setFilterChanging(true);
    filterTransition.current = {
      apply,
      startedAt: Date.now(),
      timer: setTimeout(finishFilter, needsScroll && !reduceMotion ? FILTER_SCROLL_TIMEOUT_MS : FILTER_FEEDBACK_MS),
    };
    if (needsScroll) feedScroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
  };

  const handleFeedScroll = (offset: number) => {
    feedOffset.current = offset;
    const pending = filterTransition.current;
    if (!pending || offset > 1) return;
    clearTimeout(pending.timer);
    const remaining = FILTER_FEEDBACK_MS - (Date.now() - pending.startedAt);
    if (remaining <= 0) finishFilter();
    else pending.timer = setTimeout(finishFilter, remaining);
  };

  const chooseTopic = (topic: NewsTopicFilter) => {
    const next = topic === activeTopic ? "all" : topic;
    if (!activeInstrument && next === activeTopic && !filterTransition.current) {
      feedScroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
      return;
    }
    switchFilter(() => {
      setActiveInstrument(undefined);
      setActiveTopic(next);
    });
  };

  const selectInstrument = (instrument: string) => {
    if (activeInstrument === instrument) return chooseTopic("all");
    switchFilter(() => {
      setInstrumentResult(undefined);
      setActiveInstrument(instrument);
      setActiveTopic("all");
    });
  };

  useEffect(() => {
    if (activeTopic !== "all" && !topics.includes(activeTopic)) setActiveTopic("all");
  }, [activeTopic, topics]);

  const toggleDraftTopic = (id: NewsTopicId) => {
    setDraftTopics((current) => {
      if (current.includes(id)) return current.filter((topic) => topic !== id);
      return isPro || current.length < FREE_RADAR.topics ? [...current, id] : current;
    });
  };

  const saveTopics = async () => {
    if (draftTopics.length === 0) {
      Alert.alert(
        t("news.config.minimumTitle", { defaultValue: "Scegli almeno un tema" }),
        t("news.config.minimumBody", { defaultValue: "Seleziona ciò che vuoi seguire per costruire il tuo feed." })
      );
      return;
    }
    if (savingInterests.current) return;
    savingInterests.current = true;
    setSavingChoices(true);
    try {
      const saved = await setNewsInterests(draftTopics, draftInstruments, isPro);
      setHistory(saved.history);
      if (!navigation.isFocused()) return;
      Keyboard.dismiss();
      setTopics(saved.topics);
      setInstruments(saved.instruments);
      if (activeInstrument && !saved.instruments.includes(activeInstrument)) setActiveInstrument(undefined);
      if (activeTopic !== "all" && !saved.topics.includes(activeTopic)) setActiveTopic("all");
      setConfigVisible(false);
      if (firstSetup) {
        const showLaunch = await shouldShowRadarLaunch(() => navigation.isFocused());
        if (!navigation.isFocused()) return;
        setEntryPhase(showLaunch ? "launch" : "feed");
      }
      void refresh(saved.topics);
    } catch (error) {
      Alert.alert(t(error instanceof RadarLimitError ? "news.quota.locked" : "news.instruments.saveError"));
    } finally {
      savingInterests.current = false;
      setSavingChoices(false);
    }
  };

  const toggleInstrument = (id: string) => {
    setDraftInstruments((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      return isPro || current.length < FREE_RADAR.instruments ? [...current, id] : current;
    });
  };

  const renderInstrument = (item: NewsInstrument) => {
    const checked = draftInstruments.includes(item.id);
    const disabled = !isPro && (!remaining.instruments || (!checked && draftInstruments.length >= FREE_RADAR.instruments));
    const logo = instrumentBrandPaths[item.id];
    return (
      <Pressable
        key={item.id}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={`${item.name}, ${item.ticker}`}
        disabled={disabled}
        onPress={() => toggleInstrument(item.id)}
        style={[styles.catalogRow, {
          backgroundColor: checked ? `${tokens.colors.accent}16` : tokens.colors.surface,
          opacity: disabled ? 0.55 : 1,
        }]}
      >
        <View style={[styles.brandTile, { backgroundColor: item.color ?? `${tokens.colors.accent}22` }]}>
          {logo ? (
            <Svg width={22} height={22} viewBox="0 0 24 24"><Path d={logo} fill="#FFF" /></Svg>
          ) : item.icon === "apple" || item.icon === "microsoft" || item.icon === "google" ? (
            <MaterialCommunityIcons name={item.icon} size={22} color="#FFF" />
          ) : (
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.brandText, { color: item.color ? "#FFF" : tokens.colors.accent }]}>
              {item.ticker}
            </Text>
          )}
        </View>
        <View style={styles.catalogName}>
          <Text style={[styles.topicOptionText, { color: tokens.colors.text }]}>{item.name}</Text>
          <Text style={[styles.chipText, { color: tokens.colors.muted }]}>{item.ticker} · {marketLabel(item.exchange)}</Text>
        </View>
        <MaterialCommunityIcons name={checked ? "check-circle" : "plus-circle-outline"} size={21} color={checked ? tokens.colors.accent : tokens.colors.muted} />
      </Pressable>
    );
  };

  const openNewsUrl = async (url: string) => {
    try {
      if (!/^https?:\/\//i.test(url)) throw new Error("Invalid news link");
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("news.openError"));
    }
  };
  const openItem = (item: NewsItem) => openNewsUrl(item.url);
  const toggleArticle = (url: string) => {
    setExpandedArticles((current) => {
      const next = new Set(current);
      if (!next.delete(url)) next.add(url);
      return next;
    });
  };
  const formatArticleDate = (item: NewsItem) => {
    const date = item.publishedAt ? new Date(item.publishedAt) : null;
    return date && Number.isFinite(date.getTime()) ? dateFormatter.format(date) : null;
  };

  function quotaNote(section: "topics" | "instruments") {
    if (isPro) return null;
    const left = remaining[section];
    const earliest = history[section].find((time) => time + RADAR_WEEK_MS > Date.now());
    const message = left === 0 && earliest !== undefined
      ? t("news.quota.resumes", { date: new Date(earliest + RADAR_WEEK_MS).toLocaleString(i18n.language) })
      : t(section === "topics" ? "news.quota.topics" : "news.quota.stocks", { left });
    return <Text style={{ color: tokens.colors.muted }}>{message}</Text>;
  }

  const stockChoices = (firstSetup || configVisible) && (
    <>
      <View style={styles.catalogHeading}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.colors.text }]}>
          {t("news.instruments.title")}
        </Text>
        <Text style={[styles.chipText, { color: tokens.colors.muted }]}>
          {isPro ? draftInstruments.length : t("news.instruments.selection", { selected: draftInstruments.length, count: FREE_RADAR.instruments })}
        </Text>
      </View>
      {quotaNote("instruments")}
      <View style={[styles.catalogSearch, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={21} color={tokens.colors.muted} />
        <TextInput
          accessibilityLabel={t("news.instruments.searchPlaceholder")}
          value={instrumentQuery}
          onChangeText={(value) => {
            setInstrumentQuery(value);
            setSearchLimit(CATALOG_PAGE_SIZE);
          }}
          placeholder={t("news.instruments.searchPlaceholder")}
          placeholderTextColor={tokens.colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.catalogInput, { color: tokens.colors.text }]}
        />
        {instrumentQuery ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("news.instruments.clearSearch")}
            onPress={() => setInstrumentQuery("")} style={styles.clearSearch}>
            <MaterialCommunityIcons name="close-circle-outline" size={20} color={tokens.colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.catalogGroups}>
        {(["all", ...INSTRUMENT_GROUPS] as const).map((group) => {
          const selected = group === instrumentGroup;
          return (
            <Pressable
              key={group}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setInstrumentGroup(group);
                setSearchLimit(CATALOG_PAGE_SIZE);
              }}
              style={[styles.catalogGroup, {
                backgroundColor: selected ? `${tokens.colors.accent}22` : tokens.colors.surface,
                borderColor: selected ? tokens.colors.accent : tokens.colors.glassBorder,
              }]}
            >
              <Text style={[styles.chipText, { color: selected ? tokens.colors.accent : tokens.colors.text }]}>
                {t(`news.instruments.groups.${group}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {searching ? (
        <>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.catalogSubtitle, { color: tokens.colors.text }]}>
            {searchResults.length ? t("news.instruments.resultCount", { count: searchResults.length }) : t("news.instruments.noMatches")}
          </Text>
          {searchResults.slice(0, searchLimit).map(renderInstrument)}
          {searchResults.length > searchLimit ? (
            <Pressable accessibilityRole="button" onPress={() => setSearchLimit((limit) => limit + CATALOG_PAGE_SIZE)}
              style={[styles.catalogGroup, { borderColor: tokens.colors.glassBorder }]}>
              <Text style={[styles.chipText, { color: tokens.colors.accent }]}>{t("news.instruments.moreMatches")}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          {draftInstruments.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={[styles.catalogSubtitle, { color: tokens.colors.text }]}>{t("news.instruments.following")}</Text>
              {draftInstruments.map(getInstrument).map((item) => item ? renderInstrument(item) : null)}
            </>
          ) : null}
          {featured.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={[styles.catalogSubtitle, { color: tokens.colors.text }]}>{t("news.instruments.featured")}</Text>
              {featured.map(renderInstrument)}
            </>
          ) : null}
        </>
      )}
    </>
  );
  const topicChoices = (firstSetup || configVisible) && (
    <>
      <Text accessibilityRole="header" style={[styles.sectionTitle, styles.topicHeading, { color: tokens.colors.text }]}>{t("news.instruments.topics")}</Text>
      {quotaNote("topics")}
      <View style={firstSetup ? styles.setupTopics : styles.topicGridItems}>
        {NEWS_TOPICS.map((topic) => {
          const selected = draftTopics.includes(topic.id);
          const disabled = !isPro && (!remaining.topics || (!selected && draftTopics.length >= FREE_RADAR.topics));
          return (
            <Pressable
              key={topic.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => toggleDraftTopic(topic.id)}
              style={[styles.topicOption, firstSetup && styles.setupTopic, {
                opacity: disabled && !selected ? 0.5 : 1,
                borderColor: selected ? tokens.colors.accent : tokens.colors.glassBorder,
                backgroundColor: selected ? `${tokens.colors.accent}16` : tokens.colors.surface,
              }]}
            >
              <MaterialCommunityIcons name={topic.icon} size={firstSetup ? 18 : 23} color={selected ? tokens.colors.accent : tokens.colors.muted} />
              <Text style={[styles.topicOptionText, firstSetup && styles.setupTopicLabel, { color: tokens.colors.text }]}>{topicLabel(topic.id)}</Text>
              <MaterialCommunityIcons name={selected ? "check-circle" : "circle-outline"} size={firstSetup ? 16 : 21} color={selected ? tokens.colors.accent : tokens.colors.muted} />
            </Pressable>
          );
        })}
      </View>
    </>
  );

  if (entryPhase === "checking") {
    return (
      <View style={styles.setupCheck}>
        <ActivityIndicator color={tokens.colors.accent} accessibilityLabel={t("news.loadingMore")} />
      </View>
    );
  }

  if (firstSetup) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.setupRoot}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.setupContent}>
          <View style={styles.setupHero}>
            <View style={[styles.setupIcon, { backgroundColor: `${tokens.colors.accent}20` }]}>
              <MaterialCommunityIcons name="radar" size={25} color={tokens.colors.accent} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: tokens.colors.text }]}>{t("news.config.firstTitle")}</Text>
            <Text style={[styles.setupDescription, { color: tokens.colors.muted }]}>{t("news.config.firstSubtitle")}</Text>
          </View>
          {!searching && topicChoices}
          {stockChoices}
        </ScrollView>
        <View style={[styles.setupFooter, {
          borderTopColor: tokens.colors.glassBorder,
          backgroundColor: tokens.colors.bg,
          paddingBottom: Math.max(12, insets.bottom),
        }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: savingChoices || draftTopics.length === 0, busy: savingChoices }}
            disabled={savingChoices || draftTopics.length === 0}
            onPress={() => void saveTopics()}
            style={({ pressed }) => [styles.setupAction, {
              backgroundColor: tokens.colors.accent,
              opacity: draftTopics.length === 0 ? 0.5 : pressed ? 0.78 : 1,
            }]}
          >
            {savingChoices ? <ActivityIndicator color={tokens.colors.bg} /> : null}
            <Text style={[styles.setupActionLabel, { color: tokens.colors.bg }]}>{t("news.config.firstAction")}</Text>
          </Pressable>
          {draftTopics.length === 0 ? (
            <Text style={[styles.setupDescription, { color: tokens.colors.muted }]}>{t("news.config.minimumTitle")}</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <>
      <ScrollView
        ref={feedScroll}
        accessibilityElementsHidden={showingIntro}
        importantForAccessibility={showingIntro ? "no-hide-descendants" : "auto"}
        onScroll={(event) => handleFeedScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        stickyHeaderIndices={showSaved ? undefined : [1]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(24, insets.bottom + 12) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={showSaved ? undefined : (
          <RefreshControl
            refreshing={viewLoading}
            onRefresh={refreshView}
            tintColor={tokens.colors.accent}
          />
        )}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={[styles.title, { color: tokens.colors.text }]}>
              {t(showSaved ? "news.saved.tab" : "news.briefing")}
            </Text>
          </View>
          <HeaderAction
            icon={showSaved ? "arrow-left" : "bookmark-outline"}
            labelKey={showSaved ? "news.feedTab" : "news.saved.tab"}
            onPress={() => {
              if (filterTransition.current) {
                clearTimeout(filterTransition.current.timer);
                filterTransition.current = null;
                setFilterChanging(false);
              }
              setShowSaved(!showSaved);
              feedScroll.current?.scrollTo({ y: 0, animated: false });
              if (!showSaved && savedItems === null && !saving.current) void readBookmarks();
            }}
          />
        </View>

        {!showSaved ? (
          <View style={[styles.pinnedFilters, { backgroundColor: tokens.colors.bg }]}>
            <View style={styles.filterBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Pressable
                  onPress={() => chooseTopic("all")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: allSelected }}
                  style={[
                    styles.chip,
                    {
                      borderColor: allSelected ? tokens.colors.accent : tokens.colors.glassBorder,
                      backgroundColor: allSelected ? `${tokens.colors.accent}22` : tokens.colors.surface,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="view-grid-outline" size={15} color={allSelected ? tokens.colors.accent : tokens.colors.muted} />
                  <Text style={[styles.chipText, { color: allSelected ? tokens.colors.accent : tokens.colors.text }]}>
                    {t("news.filters.all", { defaultValue: "Tutte" })}
                  </Text>
                  <View style={[styles.chipCount, { backgroundColor: allSelected ? `${tokens.colors.accent}28` : `${tokens.colors.muted}14` }]}>
                    <Text style={[styles.chipCountText, { color: allSelected ? tokens.colors.accent : tokens.colors.muted }]}>{items.length}</Text>
                  </View>
                </Pressable>
                {visibleTopicIds.map((topic) => (
                  <Pressable
                    key={topic.id}
                    onPress={() => chooseTopic(topic.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeTopic === topic.id }}
                    style={[
                      styles.chip,
                      {
                        borderColor: activeTopic === topic.id ? tokens.colors.accent : tokens.colors.glassBorder,
                        backgroundColor: activeTopic === topic.id ? `${tokens.colors.accent}22` : tokens.colors.surface,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name={topic.icon} size={15} color={activeTopic === topic.id ? tokens.colors.accent : tokens.colors.muted} />
                    <Text style={[styles.chipText, { color: activeTopic === topic.id ? tokens.colors.accent : tokens.colors.text }]}>{topicLabel(topic.id)}</Text>
                    <View style={[styles.chipCount, { backgroundColor: activeTopic === topic.id ? `${tokens.colors.accent}28` : `${tokens.colors.muted}14` }]}>
                      <Text style={[styles.chipCountText, { color: activeTopic === topic.id ? tokens.colors.accent : tokens.colors.muted }]}>{topicCounts[topic.id]}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              {filterChanging ? (
                <View pointerEvents="none" style={[styles.filterFeedback, { backgroundColor: tokens.colors.surface }]}>
                  <ActivityIndicator
                    accessibilityLabel={t("news.filters.updating")}
                    accessibilityRole="progressbar"
                    size="small"
                    color={tokens.colors.accent}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.watchlist}>
              <View style={styles.watchlistHeader}>
                <Text accessibilityRole="header" style={[styles.watchlistTitle, { color: tokens.colors.text }]}>
                  {t("news.instruments.following")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("news.config.action")}
                  onPress={() => {
                    setDraftTopics(topics);
                    setDraftInstruments(instruments);
                    setInstrumentQuery("");
                    setInstrumentGroup("all");
                    setSearchLimit(CATALOG_PAGE_SIZE);
                    setConfigVisible(true);
                  }}
                  style={styles.watchlistButton}
                >
                  <Text style={[styles.chipText, { color: tokens.colors.accent }]}>{t("news.instruments.manage")}</Text>
                  <MaterialCommunityIcons name={instruments.length ? "chevron-right" : "plus"} size={16} color={tokens.colors.accent} />
                </Pressable>
              </View>
              {instruments.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.watchlistRail}>
                  {instruments.map((id) => {
                    const entry = getInstrument(id);
                    if (!entry) return null;
                    const selected = id === activeInstrument;
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityLabel={t("news.instruments.filter", { instrument: entry.name })}
                        accessibilityState={{ selected }}
                        onPress={() => selectInstrument(id)}
                        style={[styles.watchlistItem, {
                          backgroundColor: selected ? `${tokens.colors.accent}22` : tokens.colors.surface,
                          borderColor: selected ? tokens.colors.accent : tokens.colors.glassBorder,
                        }]}
                      >
                        <View style={[styles.watchlistMark, { backgroundColor: entry.color ?? `${tokens.colors.accent}22` }]}>
                          <Text style={[styles.brandText, { color: entry.color ? "#FFF" : tokens.colors.accent }]}>{entry.ticker}</Text>
                        </View>
                        <Text numberOfLines={1} style={[styles.chipText, styles.instrumentChip, { color: tokens.colors.text }]}>{entry.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          </View>
        ) : null}

        {!showSaved && !activeInstrument && !loading && (feedMode === "preview" || feedStale) ? (
          <View style={[styles.previewNote, { backgroundColor: `${tokens.colors.accent}10`, borderColor: `${tokens.colors.accent}2A` }]}>
            <MaterialCommunityIcons name={feedMode === "live" ? "access-point" : "flask-outline"} size={18} color={tokens.colors.accent} />
            <Text style={[styles.previewText, { color: tokens.colors.muted }]}>
              {feedMode === "live"
                ? t("news.staleNote", { defaultValue: "Il servizio è temporaneamente offline. Stai vedendo le ultime notizie disponibili." })
                : fallbackReason === "unavailable"
                  ? t("news.unavailableNote", { defaultValue: "Feed live non raggiungibile. Stai vedendo temporaneamente le fonti pilota." })
                  : t("news.previewNote", { defaultValue: "Anteprima del feed. Configura il servizio News per mostrare notizie reali." })}
            </Text>
          </View>
        ) : null}

        {!showSaved && instrumentView?.stale ? (
          <Text style={[styles.previewNote, { color: tokens.colors.muted, borderColor: tokens.colors.glassBorder }]}>
            {t("news.staleNote")}
          </Text>
        ) : null}

        {briefing.length > 0 ? (
          <NewsBriefing
            key={activeTopic}
            entries={briefing}
            topicLabel={topicLabel}
            formatDate={(value) => dateFormatter.format(new Date(value))}
            onOpen={(item) => void openItem(item)}
            renderBookmark={renderBookmark}
          />
        ) : null}

        {!showSaved && instrument ? (
          <NewsMarketCard key={instrument.id} instrument={instrument} refresh={instrumentRefresh} />
        ) : null}

        {showListHeader ? <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>
              {showSaved ? null : instrument ? t("news.market.stories") : briefing.length ? t("news.impact.moreStories") : activeTopicLabel ?? t("news.forYou", { defaultValue: "Ultime notizie" })}
            </Text>
            <Text style={[styles.resultCount, { color: tokens.colors.muted }]}>
              {activeInstrument && viewLoading ? t("news.loadingMore") : t(showSaved ? "news.filters.storyCount" : "news.impact.loaded", {
                count: displayedItems.length,
                defaultValue_one: "{{count}} notizia",
                defaultValue_other: "{{count}} notizie",
              })}
            </Text>
          </View>
          {!showSaved ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("news.refresh")}
            style={styles.iconButton}
            onPress={refreshView}
            disabled={viewLoading}
          >
            <MaterialCommunityIcons name={viewLoading ? "progress-clock" : "refresh"} size={21} color={tokens.colors.accent} />
          </Pressable> : null}
        </View> : null}

        <View style={styles.list}>
          {showSaved && displayedItems.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.surface }]}>
              <MaterialCommunityIcons name="bookmark-outline" size={30} color={tokens.colors.muted} />
              <Text style={[styles.emptyTitle, { color: tokens.colors.text }]}>
                {t(savedItems === null ? "news.saved.unavailable" : "news.saved.emptyTitle")}
              </Text>
              {savedItems !== null ? <Text style={[styles.emptyBody, { color: tokens.colors.muted }]}>
                {t("news.saved.emptyBody")}
              </Text> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => savedItems === null ? void readBookmarks() : setShowSaved(false)}
                style={[styles.retryButton, { borderColor: tokens.colors.accent }]}
              >
                <Text style={[styles.retryText, { color: tokens.colors.accent }]}>
                  {t(savedItems === null ? "common.retry" : "news.feedTab")}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!showSaved && activeInstrument && !viewLoading && filteredItems.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.surface }]}>
              <Text style={[styles.emptyTitle, { color: tokens.colors.text }]}>
                {t(instrumentView?.error ? "news.instruments.searchError" : "news.instruments.emptyTitle")}
              </Text>
              <Text style={[styles.emptyBody, { color: tokens.colors.muted }]}>
                {t(instrumentView?.error ? "news.instruments.searchErrorBody" : "news.instruments.emptyBody")}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={instrumentView?.error ? refreshView : () => chooseTopic("all")}
                style={[styles.retryButton, { borderColor: tokens.colors.accent }]}
              >
                <Text style={[styles.retryText, { color: tokens.colors.accent }]}>
                  {t(instrumentView?.error ? "common.retry" : "news.filters.reset")}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!showSaved && !activeInstrument && !loading && filteredItems.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.surface }]}>
              <MaterialCommunityIcons name="newspaper-remove" size={30} color={tokens.colors.muted} />
              <Text style={[styles.emptyTitle, { color: tokens.colors.text }]}>
                {t("news.empty.title", { defaultValue: "Nessuna notizia pertinente" })}
              </Text>
              <Text style={[styles.emptyBody, { color: tokens.colors.muted }]}>
                {activeTopic === "all"
                  ? t("news.empty.body", { defaultValue: "Prova ad aggiungere un altro tema o aggiorna il feed tra poco." })
                  : t("news.filters.emptyBody", { defaultValue: "Non ci sono ancora notizie per questo tema nel feed caricato." })}
              </Text>
              <Pressable
                onPress={() => activeTopic === "all" ? void refresh(topics) : chooseTopic("all")}
                accessibilityRole="button"
                style={[styles.retryButton, { borderColor: tokens.colors.accent }]}
              >
                <Text style={[styles.retryText, { color: tokens.colors.accent }]}>
                  {activeTopic === "all"
                    ? t("common.retry", { defaultValue: "Riprova" })
                    : t("news.filters.reset", { defaultValue: "Mostra tutte" })}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {displayedItems.map((item) => {
            const image = showSaved ? savedNewsImageUri(item.savedImageFile) ?? item.imageUrl : item.imageUrl;
            const date = formatArticleDate(item);
            if (expandedArticles.has(item.url)) {
              return (
                <NewsStoryCard
                  key={item.id}
                  item={{ ...item, imageUrl: image }}
                  topic={item.topics[0] ? topicLabel(item.topics[0]) : undefined}
                  source={[item.source.name, date].filter(Boolean).join(" · ")}
                  onOpenSource={() => void openItem(item)}
                  onCollapse={() => toggleArticle(item.url)}
                  bookmark={renderBookmark(item)}
                  showSourceAction
                />
              );
            }
            return (
              <GlassCardContainer key={item.id} contentStyle={styles.compactCard}>
                <Pressable
                  onPress={() => toggleArticle(item.url)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: false }}
                  accessibilityLabel={[item.title, item.source.name, date, showSaved && item.summary].filter(Boolean).join(", ")}
                  accessibilityHint={t("news.article.previewHint")}
                  style={styles.compactLink}
                >
                  <NewsArtwork item={{ ...item, imageUrl: image }} variant="thumbnail" />
                  <View style={styles.storyCopy}>
                    <Text style={[styles.compactTitle, { color: tokens.colors.text }]}>{item.title}</Text>
                    <View style={styles.sourceRow}>
                      {item.source.kind === "institutional" ? (
                        <MaterialCommunityIcons
                          name="bank-outline"
                          size={14}
                          color={tokens.colors.accent}
                          accessibilityLabel={t("news.officialSource")}
                        />
                      ) : null}
                      <Text numberOfLines={1} style={[styles.source, { color: tokens.colors.muted }]}>{item.source.name}</Text>
                      {date ? <Text style={[styles.publishedAt, { color: tokens.colors.muted }]}>{date}</Text> : null}
                    </View>
                    {item.isPreview ? (
                      <Text style={[styles.publishedAt, { color: tokens.colors.muted }]}>{t("news.pilot")}</Text>
                    ) : null}
                    {showSaved && item.summary ? (
                      <Text style={[styles.savedSummary, { color: tokens.colors.muted }]}>{item.summary}</Text>
                    ) : null}
                  </View>
                </Pressable>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={17}
                  color={tokens.colors.muted}
                  style={styles.previewChevron}
                  accessible={false}
                />
                {renderBookmark(item)}
              </GlassCardContainer>
            );
          })}
          {showLoadMore ? (
            <Pressable
              onPress={() => void loadMore()}
              disabled={loadingMore}
              accessibilityRole="button"
              style={[styles.loadMoreButton, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.surface }]}
            >
              <Text style={[styles.loadMoreText, { color: tokens.colors.accent }]}>
                {loadingMore
                  ? t("news.loadingMore", { defaultValue: "Caricamento…" })
                  : t("news.loadMore", { defaultValue: "Carica altre notizie" })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {showingIntro ? (
        <RadarLaunch busy={loading && !showSaved} reduceMotion={reduceMotion} headerHeight={0} onDone={finishIntro} />
      ) : null}

      <BottomSheet
        visible={configVisible}
        title={t("news.config.title", { defaultValue: "Cosa vuoi seguire?" })}
        onClose={() => setConfigVisible(false)}
        actionLabel={t("common.save")}
        actionDisabled={savingChoices}
        onAction={() => void saveTopics()}
        contentStyle={styles.topicGrid}
      >
        {stockChoices}
        {!searching && topicChoices}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 12 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  heroCopy: { flex: 1 },
  title: { fontSize: 27, lineHeight: 32, fontWeight: "800", letterSpacing: -0.6 },
  pinnedFilters: { paddingBottom: 8 },
  filterBar: { paddingVertical: 5, marginBottom: 6 },
  filterFeedback: { position: "absolute", right: 0, top: 5, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  chips: { gap: 8, paddingRight: 12, alignItems: "center" },
  chip: { height: 34, borderRadius: 17, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11 },
  chipText: { fontSize: 12, fontWeight: "700" },
  instrumentChip: { maxWidth: 136 },
  watchlist: { marginBottom: 10 },
  watchlistHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  watchlistTitle: { fontSize: 14, fontWeight: "800" },
  watchlistButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 3, paddingLeft: 12 },
  watchlistRail: { gap: 7, paddingRight: 10 },
  watchlistItem: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 13, paddingLeft: 5, paddingRight: 10 },
  watchlistMark: { minWidth: 36, height: 29, paddingHorizontal: 4, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catalogGroups: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catalogHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 6 },
  catalogSearch: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4, minHeight: 48, borderWidth: 1, borderRadius: 14 },
  catalogInput: { flex: 1, minHeight: 46, paddingVertical: 8, fontSize: 15 },
  clearSearch: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  catalogSubtitle: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  catalogGroup: { minHeight: 44, justifyContent: "center", paddingHorizontal: 13, borderWidth: 1, borderRadius: 14 },
  catalogRow: { minHeight: 53, paddingVertical: 5, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  catalogName: { flex: 1, gap: 3 },
  brandTile: { width: 39, height: 39, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  brandText: { color: "#FFF", fontSize: 9, fontWeight: "900" },
  topicHeading: { marginTop: 10 },
  chipCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginRight: -4 },
  chipCountText: { fontSize: 9, fontWeight: "900" },
  previewNote: { borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 9, padding: 12, marginBottom: 22 },
  previewText: { flex: 1, fontSize: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  sectionCopy: { flex: 1 },
  resultCount: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  list: { gap: 12 },
  emptyState: { alignItems: "center", borderWidth: 1, borderRadius: 20, padding: 24, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  retryButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, marginTop: 5 },
  retryText: { fontSize: 13, fontWeight: "800" },
  loadMoreButton: { minHeight: 48, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  loadMoreText: { fontSize: 13, fontWeight: "800" },
  compactCard: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingLeft: 11, paddingRight: 2 },
  compactLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  storyCopy: { flex: 1, minWidth: 0 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  source: { flex: 1, fontSize: 12, fontWeight: "700" },
  publishedAt: { fontSize: 10, fontWeight: "600" },
  compactTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  previewChevron: { marginLeft: 3 },
  savedSummary: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topicGrid: { gap: 10, paddingBottom: 30 },
  topicGridItems: { gap: 10 },
  setupCheck: { flex: 1, alignItems: "center", justifyContent: "center" },
  setupRoot: { flex: 1 },
  setupContent: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 18, gap: 10 },
  setupHero: { gap: 9, marginBottom: 8 },
  setupIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  setupDescription: { fontSize: 14, lineHeight: 20 },
  setupTopics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  setupTopic: { flexBasis: "46%", flexGrow: 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 6, gap: 5, borderRadius: 12 },
  setupTopicLabel: { fontSize: 13 },
  setupFooter: { paddingTop: 10, paddingHorizontal: 18, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  setupAction: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  setupActionLabel: { fontSize: 15, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  topicOption: { minHeight: 62, borderWidth: 1, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15 },
  topicOptionText: { flex: 1, fontSize: 15, fontWeight: "700" },
});
