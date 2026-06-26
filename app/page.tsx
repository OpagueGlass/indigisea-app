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
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { toast } from "sonner"

type Translator = ReturnType<typeof useTranslations>

// Handles errors and success messages by displaying a toast notification with the translated message.
const onError = (t: Translator) => (key: string, values?: Record<string, string>) => toast.error(t(key, values))
const onSuccess = (t: Translator) => (key: string, values?: Record<string, string>) => toast.success(t(key, values))

/**
 * Dialog for creating a new collection. The user inputs a collection name, selects a collection type
 * (transcript or audio-only), and uploads a CSV file containing words/sentences for the collection.
 * @param setCollections Function to update the list of collections after a new collection is created.
 * @param t The translator function from next-intl for translations.
 * @returns A JSX element representing the create collection dialog.
 */
function CreateCollectionDialog({
  setCollections,
  t,
  showError,
  showSuccess,
}: {
  setCollections: Dispatch<SetStateAction<Collection[]>>
  t: Translator
  showError: (key: string, values?: Record<string, string>) => void
  showSuccess: (key: string, values?: Record<string, string>) => void
}) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [collectionType, setCollectionType] = useState<CollectionTypeValue>(collectionTypes[0].value)
  const [file, setFile] = useState<File | null>(null)
  const [words, setWords] = useState<Word[]>([])

  // Resets the dialog state, toggling the dialog and clearing the uploaded words and selected file while retaining
  // the collection name and type.
  const resetDialogState = (value: boolean) => {
    setIsCreateDialogOpen(value)
    setWords([])
    setFile(null)
  }

  // Loads the selected CSV file and creates a collection based on the selected collection type
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWords([]) // Clear previously loaded words when a new file is selected
    const file = event.target.files?.[0]
    if (!file) return
    setFile(file)
    parseCSVFile(file, collectionType, setWords, showError)
  }

  // Updates the collection type and reloads the selected CSV file if it has already been uploaded
  const setType = (value: CollectionTypeValue) => {
    setCollectionType(value)
    setWords([]) // Clear previously loaded words when a new type is selected
    if (file) {
      parseCSVFile(file, value, setWords, showError)
    }
  }

  // Creates a new collection in the local database and updates the user's collections
  const createCollection = async () => {
    if (!name.trim()) {
      showError("validation.enterCollectionName")
      return
    }

    if (words.length === 0) {
      showError("validation.uploadCsvFirst")
      return
    }

    try {
      // Only audio collections have translated words
      const newCollection = {
        id: crypto.randomUUID(),
        name: name.trim(),
        wordIds: words.map((word) => word.id),
        words: words.map((word) => word.word),
        wordRecorded: words.map((_) => false),
        createdAt: new Date(),
        translatedWords: collectionType === "audio" ? words.map((word) => word.translatedWord!) : null,
      }

      await addCollection(newCollection)
      setCollections((prevCollections) => [newCollection, ...prevCollections]) // Prepend to start to maintain order

      // Reset the dialog state after successful creation
      setName("")
      resetDialogState(false)
      showSuccess("success.collectionCreated")
    } catch (error) {
      showError("errors.couldNotCreateCollection", { message: (error as Error).message })
    }
  }

  // Formats a preview of the uploaded words, showing the count and the first three words of the first three sentences
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

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={resetDialogState}>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="collection-type">{t("home.collectionTypeLabel")}</FieldLabel>
            <Select onValueChange={(value) => setType(value as CollectionTypeValue)} defaultValue={collectionType}>
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
          <Button onClick={createCollection} disabled={!name.trim() || words.length === 0}>
            {t("home.createCollectionButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Shows the card for a single collection with options to open or delete it.
 *
 * @param collection The collection to display in the card.
 * @param onOpen Callback function to open the collection.
 * @param onDelete Callback function to delete the collection.
 * @param t The translator function from next-intl for translations.
 * @returns A JSX element representing the collection card.
 */
function CollectionCard({
  collection,
  onOpen,
  onDelete,
  t,
}: {
  collection: Collection
  onOpen: () => void
  onDelete: () => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
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
        <Button className="flex-1 gap-2" onClick={onOpen}>
          <Mic className="size-4" />
          {t("home.openAndRecord")}
        </Button>
        <Button variant="outline" className="text-destructive hover:bg-destructive hover:text-white" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Home page of the Single Page Application (SPA) which switches between views based on the state of the application.
 *
 * - The main view displays the user's collections with options to create new collections or delete existing ones.
 * - When a collection is selected, the view switches to the CollectionRecorder component to record words and manage
 * recordings for the selected collection.
 **/
export default function Page() {
  // Hook to handle switching between English and Malay translations
  const t = useTranslations()

  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(false)
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null)

  const showError = onError(t)
  const showSuccess = onSuccess(t)

  // Loads the user's collections from the local database
  const loadCollections = async () => {
    try {
      const collections = await getCollections()
      setCollections(collections)
    } catch (error) {
      showError("errors.couldNotLoadCollections", { message: (error as Error).message })
    }
  }

  // Deletes a collection from the local database and updates the user's collections
  const deleteCollection = async (id: string) => {
    try {
      await removeCollection(id)
      setCollections((prevCollections) => prevCollections.filter((collection) => collection.id !== id))
      showSuccess("success.collectionDeleted")
    } catch (error) {
      showError("errors.couldNotDeleteCollection", { message: (error as Error).message })
    }
  }

  // Load the user's collections when the component mounts
  useEffect(() => {
    setLoading(true)
    loadCollections()
  }, [])

  // Show the CollectionRecorder component if a collection is selected
  if (selectedCollection) {
    return (
      <CollectionRecorder
        collection={selectedCollection}
        setSelectedCollection={setSelectedCollection}
        onBack={() => {
          setCollections((prevCollections) =>
            // Update the selected collection in collections
            prevCollections.map((collection) =>
              collection.id === selectedCollection.id ? selectedCollection : collection
            )
          )
          setSelectedCollection(null)
        }}
        showError={showError}
        showSuccess={showSuccess}
        t={t}
      />
    )
  }

  // Otherwise, show the main view with the user's collections and options to create or delete collections
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
          {/* Settings Dropdown for switching languages and themes */}
          <SettingsDropdown />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("home.headerDescription")}</p>
      </header>
      <CreateCollectionDialog setCollections={setCollections} showError={showError} showSuccess={showSuccess} t={t} />
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
          <div className="grid gap-4 sm:grid-cols-2">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onOpen={() => setSelectedCollection(collection)}
                onDelete={() => setCollectionToDelete(collection)}
                t={t}
              />
            ))}
          </div>
        )}
      </section>
      <AlertDialog open={collectionToDelete !== null} onOpenChange={(open) => !open && setCollectionToDelete(null)}>
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
                setCollectionToDelete(null)
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
