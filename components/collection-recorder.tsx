"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, Square, Check, Download, Trash2, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collection, Recording, getRecordings, addRecording, removeRecording } from "@/lib/db";
import { toast } from "sonner";

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((durationMs % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const extensionFor = (mimeType: string) => {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
};

interface CollectionRecorderProps {
  collection: Collection;
  onBack: () => void;
}

type LiveTimestamp = {
  word: string;
  startMs: number;
  endMs: number | null;
};

export function CollectionRecorder({ collection, onBack }: CollectionRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingStartRef = useRef<number>(0);
  const timestampsRef = useRef<LiveTimestamp[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDurationMs, setActiveDurationMs] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [timestamps, setTimestamps] = useState<LiveTimestamp[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({});
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const loadRecordings = async () => {
    try {
      const recordings = await getRecordings(collection.id);
      setRecordings(recordings);
    } catch (error) {
      toast.error("Could not load recordings: " + (error as Error).message);
    }
  };

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        "mediaDevices" in navigator &&
        typeof window.MediaRecorder !== "undefined"
    );

    loadRecordings();

    return () => {
      cleanupStream();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [collection.id]);

  useEffect(() => {
    if (!isRecording) {
      setActiveDurationMs(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveDurationMs(Date.now() - recordingStartRef.current);
    }, 50);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRecording]);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const recording of recordings) {
      nextUrls[recording.id] = URL.createObjectURL(recording.blob);
    }
    setRecordingUrls(nextUrls);

    return () => {
      for (const url of Object.values(nextUrls)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [recordings]);

  const startRecording = async () => {
    if (!isSupported || isRecording || isSaving) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      setCurrentWordIndex(-1);
      setTimestamps([]);
      timestampsRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsSaving(true);
        try {
          const durationMs = Date.now() - recordingStartRef.current;

          const blob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });

          if (blob.size === 0) {
            toast.error("Recording was empty. Please try again.");
            return;
          }

          const finalizedTimestamps = timestampsRef.current.map((ts, index, arr) => ({
            word: ts.word,
            startMs: ts.startMs,
            endMs:
              index === arr.length - 1
                ? durationMs
                : (ts.endMs ?? arr[index + 1]?.startMs ?? durationMs),
          }));

          const newRecording: Recording = {
            id: crypto.randomUUID(),
            collectionId: collection.id,
            createdAt: new Date(),
            durationMs,
            size: blob.size,
            mimeType: blob.type,
            blob,
            timestamps: finalizedTimestamps,
          };

          await addRecording(newRecording);
          await loadRecordings();
        } catch (error) {
          toast.error("Could not save this recording: " + (error as Error).message);
        } finally {
          cleanupStream();
          chunksRef.current = [];
          setIsSaving(false);
          setCurrentWordIndex(-1);
          setTimestamps([]);
          timestampsRef.current = [];
        }
      };

      recordingStartRef.current = Date.now();
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      cleanupStream();
      toast.error("Microphone access was denied or unavailable.");
    }
  };

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    setIsRecording(false);
    mediaRecorder.stop();
  };

  const markWord = () => {
    if (!isRecording || collection.words.length === 0) return;

    const nowMs = Date.now() - recordingStartRef.current;

    if (currentWordIndex === -1) {
      // First press starts word 1.
      const firstWord = collection.words[0];
      const next = [{ word: firstWord, startMs: nowMs, endMs: null }];
      timestampsRef.current = next;
      setTimestamps(next);
      setCurrentWordIndex(0);
      return;
    }

    if (currentWordIndex >= collection.words.length - 1) return;

    const nextWordIndex = currentWordIndex + 1;
    const nextWord = collection.words[nextWordIndex];

    setTimestamps((prev) => {
      const next = [...prev];

      if (next.length > 0 && next[next.length - 1].endMs === null) {
        next[next.length - 1] = {
          ...next[next.length - 1],
          endMs: nowMs,
        };
      }

      next.push({ word: nextWord, startMs: nowMs, endMs: null });
      timestampsRef.current = next;
      return next;
    });

    setCurrentWordIndex(nextWordIndex);
  };

  const deleteRecording = async (id: string) => {
    try {
      await removeRecording(id);
      await loadRecordings();
      if (selectedRecording?.id === id) {
        setSelectedRecording(null);
      }
    } catch (error) {
      toast.error("Could not delete recording: " + (error as Error).message);
    }
  };

  const seekToTimestamp = (timestampMs: number) => {
    if (audioRef.current && selectedRecording) {
      audioRef.current.currentTime = timestampMs / 1000;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const startedWordsCount = currentWordIndex < 0 ? 0 : currentWordIndex + 1;
  const progress = isRecording && collection.words.length > 0
    ? (startedWordsCount / collection.words.length) * 100
    : 0;

  return (
    <main className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-4">
          <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
            <ArrowLeft className="size-4" />
            Back to Collections
          </Button>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Recording Session
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {collection.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {collection.words.length} words in this collection
            </p>
          </div>
        </header>

        {!isSupported && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            This browser does not support audio recording. Try Chrome, Edge, or Safari.
          </div>
        )}

        {/* Recording Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="size-5" />
              Record Words
            </CardTitle>
            <CardDescription>
              Start recording, then click the button each time you say a word to mark its timestamp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isRecording && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {startedWordsCount} / {collection.words.length} words started
                    </span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="rounded-lg border bg-muted/50 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Current Word</p>
                  {currentWordIndex === -1 && collection.words.length > 0 ? (
                    <>
                      <p className="text-base font-medium text-muted-foreground">
                        Press Mark Word to start the first word.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        First: {collection.words[0]}
                      </p>
                    </>
                  ) : currentWordIndex >= 0 && currentWordIndex < collection.words.length ? (
                    <p className="text-3xl font-bold text-foreground">
                      {collection.words[currentWordIndex]}
                    </p>
                  ) : (
                    <p className="text-xl font-medium text-primary flex items-center justify-center gap-2">
                      <Check className="size-5" />
                      All words marked!
                    </p>
                  )}
                  {currentWordIndex >= 0 && currentWordIndex < collection.words.length - 1 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Next: {collection.words[currentWordIndex + 1]}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-lg font-mono">
                  <span className="inline-flex size-3 animate-pulse rounded-full bg-destructive" />
                  {formatDuration(activeDurationMs)}
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              {!isRecording ? (
                <Button
                  size="lg"
                  onClick={startRecording}
                  disabled={!isSupported || isSaving}
                  className="gap-2"
                >
                  <Mic className="size-5" />
                  Start Recording
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={markWord}
                    disabled={
                      collection.words.length === 0 ||
                      (currentWordIndex >= collection.words.length - 1 && currentWordIndex !== -1)
                    }
                    className="gap-2 min-w-[200px]"
                  >
                    <Check className="size-5" />
                    {currentWordIndex === -1
                      ? `Start Word (1/${collection.words.length})`
                      : `Next Word (${Math.min(currentWordIndex + 2, collection.words.length)}/${collection.words.length})`}
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={stopRecording}
                    className="gap-2"
                  >
                    <Square className="size-5" />
                    Stop Recording
                  </Button>
                </>
              )}
            </div>

            {isRecording && timestamps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Marked Words</p>
                <div className="flex flex-wrap gap-2">
                  {timestamps.map((wt, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {wt.word}
                      <span className="text-muted-foreground text-xs">
                        @{formatDuration(wt.startMs)}
                        {wt.endMs !== null ? ` - ${formatDuration(wt.endMs)}` : ""}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Recordings */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            Saved Recordings
          </h2>

          {recordings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Mic className="size-8 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  No recordings yet. Start recording to create one.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {recordings.map((recording) => {
                const isSelected = selectedRecording?.id === recording.id;
                const src = recordingUrls[recording.id];

                return (
                  <Card
                    key={recording.id}
                    className={isSelected ? "ring-2 ring-primary" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {new Date(recording.createdAt).toLocaleString()}
                          </CardTitle>
                          <CardDescription>
                            {formatDuration(recording.durationMs)} • {formatBytes(recording.size)} •{" "}
                            {recording.timestamps.length} words marked
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => {
                              setSelectedRecording(isSelected ? null : recording);
                              setIsPlaying(false);
                              setPlaybackTime(0);
                            }}
                          >
                            {isSelected ? "Hide" : "View Words"}
                          </Button>
                          {src && (
                            <a
                              href={src}
                              download={`${collection.name}-${recording.createdAt}.${extensionFor(recording.mimeType)}`}
                              className="inline-flex"
                            >
                              <Button size="sm" variant="outline">
                                <Download className="size-4" />
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive hover:text-white"
                            onClick={() => deleteRecording(recording.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {isSelected && (
                      <CardContent className="space-y-4 border-t pt-4">
                        {src && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={togglePlayback}
                                className="gap-2"
                              >
                                {isPlaying ? (
                                  <>
                                    <Pause className="size-4" /> Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="size-4" /> Play
                                  </>
                                )}
                              </Button>
                              <span className="text-sm text-muted-foreground font-mono">
                                {formatDuration(playbackTime * 1000)} / {formatDuration(recording.durationMs)}
                              </span>
                            </div>
                            <audio
                              ref={audioRef}
                              src={src}
                              onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                              onEnded={() => setIsPlaying(false)}
                              className="hidden"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Word Timestamps</p>
                          <p className="text-xs text-muted-foreground">
                            Click a word to jump to that point in the recording.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {recording.timestamps.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No words were marked in this recording.
                              </p>
                            ) : (
                              recording.timestamps.map((wt, i) => (
                                <Button
                                  key={i}
                                  onClick={() => seekToTimestamp(wt.startMs)}
                                  variant="outline"
                                  className="items-center"
                                  // className="items-center gap-1.5 rounded-md border bg-card px-1.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                >
                                  <div className="justify-between">
                                  <span className="font-medium pr-1.5">{wt.word}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(wt.startMs)} - {formatDuration(wt.endMs)}
                                  </span>
                                  </div>
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
