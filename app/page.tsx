"use client"

import { CollectionRecorder } from "@/components/audio/collection-recorder"
import { SettingsDropdown } from "@/components/settings-dropdown"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addCollection, Collection, getCollections, removeCollection } from "@/lib/db"
import { collectionTypes, CollectionTypeValue, parseCSVFile, Word } from "@/lib/parse-csv"
import { FolderOpen, Mic, Plus, Trash2, Upload } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function Page() {
  const t = useTranslations()

  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null)
  const [selectedCollectionType, setSelectedCollectionType] = useState<CollectionTypeValue>(collectionTypes[0].value)
  const [file, setFile] = useState<File | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWords([])
    const file = event.target.files?.[0]
    if (!file) return
    setFile(file)
    parseCSVFile(file, setWords, selectedCollectionType, t)
  }

  const setType = (value: CollectionTypeValue) => {
    setSelectedCollectionType(value)
    setWords([])
    if (file) {
      parseCSVFile(file, setWords, value, t)
    }
  }

  const loadCollections = async () => {
    try {
      const collections = await getCollections()
      setCollections(collections)
    } catch (error) {
      toast.error(t("errors.couldNotLoadCollections", { message: (error as Error).message }))
    }
  }

  const createCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error(t("validation.enterCollectionName"))
      return
    }
    if (words.length === 0) {
      toast.error(t("validation.uploadCsvFirst"))
      return
    }

    try {
      // Only audio collections have translated words
      const newCollection = {
        id: crypto.randomUUID(),
        name: newCollectionName.trim(),
        wordIds: words.map((word) => word.id),
        words: words.map((word) => word.word),
        wordRecorded: words.map((_) => false),
        createdAt: new Date(),
        translatedWords: selectedCollectionType === "audio" ? words.map((word) => word.translatedWord!) : null,
      }

      await addCollection(newCollection)
      await loadCollections()

      setIsCreateDialogOpen(false)
      setNewCollectionName("")
      setWords([])
      setFile(null)
      toast.success(t("success.collectionCreated"))
    } catch (error) {
      toast.error(t("errors.couldNotCreateCollection", { message: (error as Error).message }))
    }
  }

  const deleteCollection = async (id: string) => {
    try {
      await removeCollection(id)
      await loadCollections()
    } catch (error) {
      toast.error(t("errors.couldNotDeleteCollection", { message: (error as Error).message }))
    }
  }

  const formatPreview = (words: Word[]) => {
    const previewWords = words.slice(0, 3).map((word) => word.word)
    const previewSentences = previewWords.map((sentence) => {
      const sentenceWords = sentence.split(" ")
      if (sentenceWords.length > 3) {
        return sentenceWords.slice(0, 3).join(" ") + "..."
      }
      return sentence
    })
    const preview = previewSentences.join(", ") + (words.length > 3 ? ", ..." : "")
    return t("home.previewWordsLoaded", { count: words.length, preview })
  }

  useEffect(() => {
    setLoading(true)
    loadCollections()
  }, [])

  if (selectedCollection) {
    return (
      <CollectionRecorder
        collection={selectedCollection}
        setSelectedCollection={setSelectedCollection}
        onBack={() => setSelectedCollection(null)}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 bg-background px-4 py-8">
      <header className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {t("home.headerKicker")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t("home.headerTitle")}</h1>
          </div>
          <SettingsDropdown />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("home.headerDescription")}</p>
      </header>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(value) => {
          setIsCreateDialogOpen(value)
          setWords([])
          setFile(null)
        }}
      >
        <DialogTrigger asChild>
          <Button size="lg" className="h-10 w-full gap-2 p-4 md:w-fit">
            <Plus className="size-4" />
            {t("home.createCollectionButton")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("home.createDialogDescription")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="collection-name">{t("home.collectionNameLabel")}</FieldLabel>
              <Input
                id="collection-name"
                placeholder={t("home.collectionNamePlaceholder")}
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="collection-type">{t("home.collectionTypeLabel")}</FieldLabel>
              <Select
                onValueChange={(value) => setType(value as CollectionTypeValue)}
                defaultValue={selectedCollectionType}
              >
                <SelectTrigger id="collection-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {collectionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(type.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="csv-upload">{t("home.uploadWordListLabel")}</FieldLabel>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <FieldDescription>
                {words.length > 0 ? formatPreview(words) : t("home.uploadWordListHelperEmpty")}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={createCollection} disabled={!newCollectionName.trim() || words.length === 0}>
              {t("home.createCollectionButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          {t("home.collectionsSectionTitle")}
        </h2>

        {collections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Upload className="mb-4 size-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t("home.emptyCollections")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <Card key={collection.id} className="group relative gap-2">
                <CardHeader>
                  <div className="flex justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FolderOpen className="size-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{collection.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(collection.createdAt).toLocaleDateString("en-MY")}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="h-7 px-2.5">
                      {collection.translatedWords ? t("home.badgeAudioOnly") : t("home.badgeTranscript")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="mb-1">
                  <p>{t("home.collectionCardWordCount", { count: collection.words.length })}</p>
                  <p className="line-clamp-2 truncate text-sm text-muted-foreground">
                    {collection.words.slice(0, 3).join(", ")}
                    {collection.words.length > 3 && "..."}
                  </p>
                </CardContent>
                <CardFooter className="gap-2 border-t">
                  <Button className="flex-1 gap-2" onClick={() => setSelectedCollection(collection)}>
                    <Mic className="size-4" />
                    {t("home.openAndRecord")}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => {
                      setCollectionToDelete(collection)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("home.deleteCollectionTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("home.deleteCollectionDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (collectionToDelete) {
                  deleteCollection(collectionToDelete.id)
                }
                setShowDeleteDialog(false)
              }}
              variant="destructive"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
