import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius, type ColorScheme } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocale, t } from '@/services/i18n';
import {
  getAllNotes,
  createNote,
  updateNote,
  deleteNote,
  addImageToNote,
  removeImageFromNote,
  subscribe,
  setS3Config,
  getS3Config,
  hasS3Config,
  syncAllNotes,
  getUnsyncedCount,
  type Note,
  type S3Config,
} from '@/services/notes';
import { primeNotesInterstitial, showNotesInterstitial } from '@/services/ads';

// ─── Priority config ────────────────────────────────────────────────────────

function getPriorities(c: ColorScheme): { key: Note['priority']; label: string; color: string }[] {
  return [
    { key: 'low' as Note['priority'], label: 'Low', color: c.green },
    { key: 'normal' as Note['priority'], label: 'Normal', color: c.cyan },
    { key: 'high' as Note['priority'], label: 'High', color: c.amber },
    { key: 'critical' as Note['priority'], label: 'Critical', color: c.red },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getPriorityColor(priority: Note['priority'], c: ColorScheme): string {
  switch (priority) {
    case 'critical': return c.red;
    case 'high': return c.amber;
    case 'normal': return c.cyan;
    case 'low': return c.green;
  }
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const locale = useLocale();
  const { colors } = useTheme();
  const PRIORITIES = useMemo(() => getPriorities(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notes, setNotes] = useState<Note[]>(getAllNotes());
  const [showEditor, setShowEditor] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showS3Config, setShowS3Config] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(getUnsyncedCount());

  // Editor state
  const [edTitle, setEdTitle] = useState('');
  const [edContent, setEdContent] = useState('');
  const [edPriority, setEdPriority] = useState<Note['priority']>('normal');
  const [edTags, setEdTags] = useState('');
  const [edImages, setEdImages] = useState<string[]>([]);

  // S3 config state
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');

  // Subscribe to note changes
  useEffect(() => {
    const unsub = subscribe(() => {
      setNotes(getAllNotes());
      setUnsyncedCount(getUnsyncedCount());
    });
    return unsub;
  }, []);

  // Load S3 config
  useEffect(() => {
    const config = getS3Config();
    if (config) {
      setS3Endpoint(config.endpoint);
      setS3Bucket(config.bucket);
      setS3Region(config.region);
      setS3AccessKey(config.accessKeyId);
      setS3SecretKey(config.secretAccessKey);
    }
  }, []);

  useEffect(() => {
    void primeNotesInterstitial();
  }, []);

  // ─── Open editor ─────────────────────────────────────────────────────

  const openNewNote = useCallback(() => {
    setEditingNote(null);
    setEdTitle('');
    setEdContent('');
    setEdPriority('normal');
    setEdTags('');
    setEdImages([]);
    setShowEditor(true);
  }, []);

  const handleCreateFirstNote = useCallback(async () => {
    await showNotesInterstitial();
    openNewNote();
  }, [openNewNote]);

  const openEditNote = useCallback((note: Note) => {
    setEditingNote(note);
    setEdTitle(note.title);
    setEdContent(note.content);
    setEdPriority(note.priority);
    setEdTags(note.tags.join(', '));
    setEdImages(note.images.map((img) => img.uri));
    setShowDetail(false);
    setShowEditor(true);
  }, []);

  // ─── Save note ───────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!edTitle.trim() && !edContent.trim()) {
      Alert.alert(t('error') || 'Error', 'Please enter a title or content');
      return;
    }

    const tags = edTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (editingNote) {
      updateNote(editingNote.id, {
        title: edTitle.trim(),
        content: edContent.trim(),
        priority: edPriority,
        tags,
      });
      // Handle images for existing note
      const existingImageUris = editingNote.images.map((img) => img.uri);
      for (const uri of edImages) {
        if (!existingImageUris.includes(uri)) {
          addImageToNote(editingNote.id, uri);
        }
      }
      for (const img of editingNote.images) {
        if (!edImages.includes(img.uri)) {
          removeImageFromNote(editingNote.id, img.id);
        }
      }
    } else {
      const note = createNote({
        title: edTitle.trim() || 'Untitled Note',
        content: edContent.trim(),
        priority: edPriority,
        tags,
      });
      for (const uri of edImages) {
        addImageToNote(note.id, uri);
      }
    }

    setShowEditor(false);
  }, [edTitle, edContent, edPriority, edTags, edImages, editingNote]);

  // ─── Delete note ─────────────────────────────────────────────────────

  const handleDelete = useCallback((noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This cannot be undone.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteNote(noteId);
            setShowDetail(false);
          },
        },
      ]
    );
  }, []);

  // ─── Capture image (placeholder) ─────────────────────────────────────

  const handleCaptureImage = useCallback(() => {
    // In production, this would use expo-camera or expo-image-picker
    const mockUri = `file:///mock-capture-${generateId()}.jpg`;
    setEdImages((prev) => [...prev, mockUri]);
    Alert.alert(
      'Camera Capture',
      'In the production version, this will open the camera to capture a photo. A placeholder image has been added.',
      [{ text: t('ok') || 'OK' }]
    );
  }, []);

  const handleRemoveImage = useCallback((uri: string) => {
    setEdImages((prev) => prev.filter((u) => u !== uri));
  }, []);

  // ─── Sync ────────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    if (!hasS3Config()) {
      setShowS3Config(true);
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncAllNotes();
      Alert.alert(
        'Sync Complete',
        `Synced: ${result.synced}, Failed: ${result.failed}`,
        [{ text: t('ok') || 'OK' }]
      );
    } catch {
      Alert.alert('Sync Error', 'Failed to sync notes. Check your connection and S3 config.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // ─── Save S3 config ──────────────────────────────────────────────────

  const handleSaveS3 = useCallback(() => {
    if (!s3Endpoint.trim() || !s3Bucket.trim()) {
      Alert.alert(t('error') || 'Error', 'Endpoint and Bucket are required');
      return;
    }
    setS3Config({
      endpoint: s3Endpoint.trim(),
      bucket: s3Bucket.trim(),
      region: s3Region.trim() || 'us-east-1',
      accessKeyId: s3AccessKey.trim(),
      secretAccessKey: s3SecretKey.trim(),
    });
    setShowS3Config(false);
    Alert.alert(t('success') || 'Success', 'S3 configuration saved');
  }, [s3Endpoint, s3Bucket, s3Region, s3AccessKey, s3SecretKey]);

  // ─── Render note card ────────────────────────────────────────────────

  const renderNoteCard = useCallback(({ item }: { item: Note }) => {
    const priorityColor = getPriorityColor(item.priority, colors);
    return (
      <TouchableOpacity
        style={[styles.noteCard, { borderLeftColor: priorityColor }]}
        onPress={() => {
          setSelectedNote(item);
          setShowDetail(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.noteCardHeader}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.noteCardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.noteCardMeta}>
            {item.images.length > 0 && (
              <View style={styles.imageCountBadge}>
                <Ionicons name="image" size={10} color={colors.textSecondary} />
                <Text style={styles.imageCountText}>{item.images.length}</Text>
              </View>
            )}
            {item.synced ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={14} color={colors.textDim} />
            )}
          </View>
        </View>
        {item.content ? (
          <Text style={styles.noteCardContent} numberOfLines={2}>
            {item.content}
          </Text>
        ) : null}
        <View style={styles.noteCardFooter}>
          <Text style={styles.noteCardTime}>{formatDate(item.updatedAt)}</Text>
          {item.tags.length > 0 && (
            <View style={styles.tagRow}>
              {item.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
              {item.tags.length > 3 && (
                <Text style={styles.moreTagsText}>+{item.tags.length - 3}</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, styles]);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerAccent} />
            <Text style={styles.headerTitle}>FIELD NOTES</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowS3Config(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="server-outline"
                size={18}
                color={hasS3Config() ? colors.green : colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSync}
              activeOpacity={0.7}
              disabled={isSyncing}
            >
              <Ionicons
                name={isSyncing ? 'sync' : 'cloud-upload-outline'}
                size={18}
                color={unsyncedCount > 0 ? colors.amber : colors.textSecondary}
              />
              {unsyncedCount > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{unsyncedCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, styles.addButton]}
              onPress={openNewNote}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={colors.bg} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Notes List */}
      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={colors.textDim} />
          <Text style={styles.emptyTitle}>No Notes Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start logging your observations, locations, and survival notes
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handleCreateFirstNote}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={colors.bg} />
            <Text style={styles.emptyButtonText}>Create First Note</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNoteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notesList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Editor Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editorModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editorHeader}>
                <Text style={styles.editorTitle}>
                  {editingNote ? 'Edit Note' : 'New Note'}
                </Text>
                <TouchableOpacity onPress={() => setShowEditor(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <TextInput
                style={styles.editorTitleInput}
                value={edTitle}
                onChangeText={setEdTitle}
                placeholder="Note title..."
                placeholderTextColor={colors.textDim}
                maxLength={100}
              />

              {/* Content */}
              <TextInput
                style={styles.editorContentInput}
                value={edContent}
                onChangeText={setEdContent}
                placeholder="Write your observations, location details, survival notes..."
                placeholderTextColor={colors.textDim}
                multiline
                textAlignVertical="top"
              />

              {/* Priority */}
              <Text style={styles.editorLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      styles.priorityPill,
                      edPriority === p.key && { backgroundColor: `${p.color}20`, borderColor: p.color },
                    ]}
                    onPress={() => setEdPriority(p.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.priorityPillDot, { backgroundColor: p.color }]} />
                    <Text
                      style={[
                        styles.priorityPillText,
                        edPriority === p.key && { color: p.color },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tags */}
              <Text style={styles.editorLabel}>Tags (comma separated)</Text>
              <TextInput
                style={styles.editorTagsInput}
                value={edTags}
                onChangeText={setEdTags}
                placeholder="water, shelter, location..."
                placeholderTextColor={colors.textDim}
              />

              {/* Images */}
              <View style={styles.imagesSection}>
                <Text style={styles.editorLabel}>Images</Text>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={handleCaptureImage}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera" size={20} color={colors.amber} />
                  <Text style={styles.captureButtonText}>Capture Photo</Text>
                </TouchableOpacity>
                {edImages.length > 0 && (
                  <View style={styles.imageGrid}>
                    {edImages.map((uri) => (
                      <View key={uri} style={styles.imageThumbnail}>
                        <View style={styles.imagePlaceholder}>
                          <Ionicons name="image" size={24} color={colors.textDim} />
                        </View>
                        <TouchableOpacity
                          style={styles.imageRemoveButton}
                          onPress={() => handleRemoveImage(uri)}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.red} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={styles.editorActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowEditor(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>{t('cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark" size={18} color={colors.bg} />
                  <Text style={styles.saveButtonText}>{t('save') || 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showDetail && selectedNote !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedNote && (
                <>
                  <View style={styles.detailHeader}>
                    <TouchableOpacity onPress={() => setShowDetail(false)}>
                      <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.detailHeaderActions}>
                      <TouchableOpacity
                        onPress={() => openEditNote(selectedNote)}
                        style={styles.detailAction}
                      >
                        <Ionicons name="create-outline" size={20} color={colors.amber} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(selectedNote.id)}
                        style={styles.detailAction}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.detailMeta}>
                    <View style={[styles.detailPriority, { backgroundColor: `${getPriorityColor(selectedNote.priority, colors)}20` }]}>
                      <View style={[styles.priorityPillDot, { backgroundColor: getPriorityColor(selectedNote.priority, colors) }]} />
                      <Text style={[styles.detailPriorityText, { color: getPriorityColor(selectedNote.priority, colors) }]}>
                        {selectedNote.priority.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.detailDate}>
                      {selectedNote.updatedAt.toLocaleString()}
                    </Text>
                  </View>

                  <Text style={styles.detailTitle}>{selectedNote.title}</Text>

                  {selectedNote.tags.length > 0 && (
                    <View style={styles.detailTags}>
                      {selectedNote.tags.map((tag) => (
                        <View key={tag} style={styles.detailTag}>
                          <Text style={styles.detailTagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.detailContent}>{selectedNote.content}</Text>

                  {selectedNote.images.length > 0 && (
                    <View style={styles.detailImages}>
                      <Text style={styles.detailImagesTitle}>
                        Attached Images ({selectedNote.images.length})
                      </Text>
                      {selectedNote.images.map((img) => (
                        <View key={img.id} style={styles.detailImageCard}>
                          <View style={styles.detailImagePlaceholder}>
                            <Ionicons name="image" size={32} color={colors.textDim} />
                            <Text style={styles.detailImageUri}>{img.uri}</Text>
                          </View>
                          <View style={styles.detailImageMeta}>
                            <Text style={styles.detailImageDate}>
                              {img.timestamp.toLocaleString()}
                            </Text>
                            {img.synced ? (
                              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                            ) : (
                              <Ionicons name="cloud-upload-outline" size={14} color={colors.textDim} />
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.detailSyncStatus}>
                    {selectedNote.synced ? (
                      <View style={styles.syncStatusRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                        <Text style={[styles.syncStatusText, { color: colors.green }]}>
                          Synced {selectedNote.syncedAt?.toLocaleString()}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.syncStatusRow}>
                        <Ionicons name="cloud-upload-outline" size={16} color={colors.textDim} />
                        <Text style={[styles.syncStatusText, { color: colors.textDim }]}>
                          Not synced
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── S3 Config Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showS3Config}
        transparent
        animationType="slide"
        onRequestClose={() => setShowS3Config(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.s3Modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editorHeader}>
                <View>
                  <Text style={styles.editorTitle}>Cloud Sync</Text>
                  <Text style={styles.s3Subtitle}>S3-compatible storage</Text>
                </View>
                <TouchableOpacity onPress={() => setShowS3Config(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.editorLabel}>Endpoint</Text>
              <TextInput
                style={styles.s3Input}
                value={s3Endpoint}
                onChangeText={setS3Endpoint}
                placeholder="https://s3.amazonaws.com"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.editorLabel}>Bucket</Text>
              <TextInput
                style={styles.s3Input}
                value={s3Bucket}
                onChangeText={setS3Bucket}
                placeholder="my-survival-notes"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.editorLabel}>Region</Text>
              <TextInput
                style={styles.s3Input}
                value={s3Region}
                onChangeText={setS3Region}
                placeholder="us-east-1"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.editorLabel}>Access Key ID</Text>
              <TextInput
                style={styles.s3Input}
                value={s3AccessKey}
                onChangeText={setS3AccessKey}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.editorLabel}>Secret Access Key</Text>
              <TextInput
                style={styles.s3Input}
                value={s3SecretKey}
                onChangeText={setS3SecretKey}
                placeholder="wJalrXUtnFEMI/K7MDENG..."
                placeholderTextColor={colors.textDim}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.s3Note}>
                Your credentials are stored locally on this device only.
                Supports AWS S3, MinIO, DigitalOcean Spaces, and other S3-compatible services.
              </Text>

              <View style={styles.editorActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowS3Config(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>{t('cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveS3}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark" size={18} color={colors.bg} />
                  <Text style={styles.saveButtonText}>{t('save') || 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: c.bg,
    },

    // Header
    header: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerAccent: {
      width: 3,
      height: 22,
      backgroundColor: c.amber,
      borderRadius: 2,
      marginRight: Spacing.sm,
    },
    headerTitle: {
      fontSize: FontSize.xl,
      fontWeight: '800',
      color: c.text,
      letterSpacing: 3,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    addButton: {
      backgroundColor: c.amber,
      borderColor: c.amber,
    },
    syncBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: c.red,
      borderRadius: 8,
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    syncBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: c.text,
    },

    // Notes list
    notesList: {
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    noteCard: {
      backgroundColor: c.bgCard,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
      borderLeftWidth: 3,
    },
    noteCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    noteCardTitle: {
      flex: 1,
      fontSize: FontSize.md,
      fontWeight: '700',
      color: c.text,
    },
    noteCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    imageCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    imageCountText: {
      fontSize: FontSize.xs,
      color: c.textSecondary,
    },
    noteCardContent: {
      fontSize: FontSize.sm,
      color: c.textSecondary,
      lineHeight: 18,
      marginBottom: Spacing.sm,
    },
    noteCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    noteCardTime: {
      fontSize: FontSize.xs,
      color: c.textDim,
    },
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    tagChip: {
      backgroundColor: `${c.amber}15`,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 1,
      borderRadius: BorderRadius.sm,
    },
    tagChipText: {
      fontSize: 9,
      color: c.amber,
      fontWeight: '600',
    },
    moreTagsText: {
      fontSize: 9,
      color: c.textDim,
    },

    // Empty state
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xxxl,
      gap: Spacing.md,
    },
    emptyTitle: {
      fontSize: FontSize.xl,
      fontWeight: '700',
      color: c.text,
      marginTop: Spacing.md,
    },
    emptySubtitle: {
      fontSize: FontSize.md,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: c.amber,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.full,
      marginTop: Spacing.lg,
    },
    emptyButtonText: {
      fontSize: FontSize.md,
      fontWeight: '700',
      color: c.bg,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    editorModal: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl + 20,
      maxHeight: '90%',
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    detailModal: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl + 20,
      maxHeight: '95%',
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    s3Modal: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl + 20,
      maxHeight: '85%',
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    editorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xl,
    },
    editorTitle: {
      fontSize: FontSize.xl,
      fontWeight: '800',
      color: c.text,
      letterSpacing: 2,
    },
    s3Subtitle: {
      fontSize: FontSize.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    editorLabel: {
      fontSize: FontSize.sm,
      fontWeight: '700',
      color: c.textSecondary,
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    editorTitleInput: {
      backgroundColor: c.bgCard,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      color: c.text,
      fontSize: FontSize.lg,
      fontWeight: '700',
    },
    editorContentInput: {
      backgroundColor: c.bgCard,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      color: c.text,
      fontSize: FontSize.md,
      minHeight: 120,
      marginTop: Spacing.md,
      lineHeight: 22,
    },
    priorityRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    priorityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    priorityPillDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    priorityPillText: {
      fontSize: FontSize.xs,
      fontWeight: '600',
      color: c.textSecondary,
    },
    editorTagsInput: {
      backgroundColor: c.bgCard,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      color: c.text,
      fontSize: FontSize.md,
    },
    imagesSection: {
      marginTop: Spacing.md,
    },
    captureButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: `${c.amber}15`,
      borderWidth: 1,
      borderColor: `${c.amber}30`,
      borderStyle: 'dashed',
    },
    captureButtonText: {
      fontSize: FontSize.md,
      fontWeight: '600',
      color: c.amber,
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    imageThumbnail: {
      width: 72,
      height: 72,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
      position: 'relative',
    },
    imagePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageRemoveButton: {
      position: 'absolute',
      top: -4,
      right: -4,
    },
    editorActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xl,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelButtonText: {
      fontSize: FontSize.md,
      fontWeight: '700',
      color: c.textSecondary,
    },
    saveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      backgroundColor: c.amber,
    },
    saveButtonText: {
      fontSize: FontSize.md,
      fontWeight: '700',
      color: c.bg,
    },
    s3Input: {
      backgroundColor: c.bgCard,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      color: c.text,
      fontSize: FontSize.md,
    },
    s3Note: {
      fontSize: FontSize.xs,
      color: c.textDim,
      lineHeight: 16,
      fontStyle: 'italic',
      marginTop: Spacing.lg,
    },

    // Detail view
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    detailHeaderActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    detailAction: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    detailPriority: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    detailPriorityText: {
      fontSize: FontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
    },
    detailDate: {
      fontSize: FontSize.sm,
      color: c.textDim,
    },
    detailTitle: {
      fontSize: FontSize.title,
      fontWeight: '800',
      color: c.text,
      marginBottom: Spacing.md,
    },
    detailTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    detailTag: {
      backgroundColor: `${c.amber}15`,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    detailTagText: {
      fontSize: FontSize.sm,
      color: c.amber,
      fontWeight: '600',
    },
    detailContent: {
      fontSize: FontSize.md,
      color: c.text,
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    detailImages: {
      marginBottom: Spacing.xl,
    },
    detailImagesTitle: {
      fontSize: FontSize.sm,
      fontWeight: '700',
      color: c.textSecondary,
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    detailImageCard: {
      backgroundColor: c.bgCard,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: Spacing.sm,
      overflow: 'hidden',
    },
    detailImagePlaceholder: {
      height: 120,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    detailImageUri: {
      fontSize: FontSize.xs,
      color: c.textDim,
      maxWidth: '80%',
    },
    detailImageMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    detailImageDate: {
      fontSize: FontSize.xs,
      color: c.textDim,
    },
    detailSyncStatus: {
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    syncStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    syncStatusText: {
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
  });
}
