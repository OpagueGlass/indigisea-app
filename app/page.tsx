"use client"

import { FolderOpen, Mic, Plus, Trash2, Upload } from "lucide-react"
import { useEffect, useState } from "react"

import { CollectionRecorder } from "@/components/audio/collection-recorder"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { addCollection, Collection, getCollections, removeCollection } from "@/lib/db"
import { parseCSVFile, Word, collectionTypes } from "@/lib/parse-csv"
import { toast } from "sonner"
import { SelectContent, SelectItem, SelectTrigger, SelectValue, Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function Page() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null)
  const [selectedCollectionType, setSelectedCollectionType] = useState(collectionTypes[0].value)
  const [file, setFile] = useState<File | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWords([])
    const file = event.target.files?.[0]
    if (!file) return
    setFile(file)
    parseCSVFile(file, setWords, selectedCollectionType)
  }

  const setType = (value: string) => {
    setSelectedCollectionType(value)
    setWords([])
    if (file) {
      parseCSVFile(file, setWords, value)
    }
  }

  const loadCollections = async () => {
    try {
      const collections = await getCollections()
      setCollections(collections)
    } catch (error) {
      toast.error("Could not load collections: " + (error as Error).message)
    }
  }

  const createCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error("Please enter a collection name.")
      return
    }
    if (words.length === 0) {
      toast.error("Please upload a CSV with words first.")
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
      toast.success("Collection created successfully.")
    } catch (error) {
      toast.error("Could not create collection: " + (error as Error).message)
    }
  }

  const deleteCollection = async (id: string) => {
    try {
      await removeCollection(id)
      await loadCollections()
    } catch (error) {
      toast.error("Could not delete collection: " + (error as Error).message)
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
    return `${words.length} words loaded: ` + previewSentences.join(", ") + (words.length > 3 ? ", ..." : "")
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
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Offline Word Recorder</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Indigisea Voice Archive</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Upload a CSV with words to create a collection, then record pronunciations with timestamps for each word.
        </p>
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
            Create Collection
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>Upload a CSV file and name your collection based on the theme.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="collection-name">Collection Name</FieldLabel>
              <Input
                id="collection-name"
                placeholder="Enter collection theme"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="collection-name">Collection Type</FieldLabel>
              <Select onValueChange={(value) => setType(value)} defaultValue={selectedCollectionType}>
                <SelectTrigger id="form-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {collectionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="csv-upload">Upload Word List</FieldLabel>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <FieldDescription>
                {words.length > 0 ? formatPreview(words) : "Select a CSV word list to upload"}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCollection} disabled={!newCollectionName.trim() || words.length === 0}>
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Your Collections</h2>

        {collections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Upload className="mb-4 size-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No collections yet. Create one by uploading a CSV word list.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <Card key={collection.id} className="group relative">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="size-5 text-primary" />
                    {collection.name}
                  </CardTitle>
                  <Badge variant="secondary" className="absolute top-4 right-4">
                    {collection.translatedWords ? "Audio Only" : "Transcript"}
                  </Badge>
                  <CardDescription>
                    {collection.words.length} words • Created {new Date(collection.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 line-clamp-2 truncate text-sm text-muted-foreground">
                    {collection.words.slice(0, 3).join(", ")}
                    {collection.words.length > 3 && "..."}
                  </p>
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={() => setSelectedCollection(collection)}>
                      <Mic className="size-4" />
                      Open & Record
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this collection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (collectionToDelete) {
                  deleteCollection(collectionToDelete.id)
                }
                setShowDeleteDialog(false)
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
