// app/[gameCode]/index.js
import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { connectSocket } from "../../services/socket";

const MAX_STORIES = 5;
const MIN_STORIES = 3;
const BACKEND_URL = "http://192.168.2.98:5000";

export default function GameLobby() {
  const { gameCode, user } = useLocalSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState([]);
  const [stories, setStories] = useState(["", "", ""]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    const socket = connectSocket(BACKEND_URL);
    socket.connect();
    socket.emit("joinGame", { pin: gameCode, username: user });
    socket.on("playersUpdate", (list) => {
      setPlayers(list.map((p) => ({ name: p.username, isHost: p.isHost })));
    });
    return () => {
      socket.off("playersUpdate");
      socket.disconnect();
    };
  }, [gameCode]);

  const openEditor = (idx) => {
    setDraftText(stories[idx]);
    setEditingIndex(idx);
  };
  const saveEditor = () => {
    if (editingIndex === null) return;
    const next = [...stories];
    next[editingIndex] = draftText;
    setStories(next);
    setEditingIndex(null);
  };
  const addStory = () => {
    if (stories.length < MAX_STORIES) {
      setStories([...stories, ""]);
    }
  };
  const removeStory = () => {
    if (stories.length > MIN_STORIES) {
      const newStories = [...stories];
      newStories.pop();
      setStories(newStories);
    }
  };
  const renderPlayer = ({ item }) => (
    <View style={styles.playerRow}>
      <MaterialCommunityIcons
        name={item.isHost ? "crown" : "emoticon-outline"}
        size={32}
        color="#F0EAD6"
        style={{ marginRight: 8 }}
      />
      <Text style={styles.playerName}>{item.name}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        {/* Close button to leave lobby */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.replace("/")}
        >
          <MaterialCommunityIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.pinLabel}>Game PIN</Text>
          <Text style={styles.codeText}>{gameCode}</Text>
          <Text style={styles.waitingText}>Waiting for players to join…</Text>
        </View>

        <FlatList
          data={players}
          keyExtractor={(p) => p.name}
          renderItem={renderPlayer}
          style={{ marginBottom: 24 }}
        />

        <Text style={styles.sectionTitle}>
          Your Stories ({MIN_STORIES} required, max {MAX_STORIES}):
        </Text>
        {stories.map((story, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => openEditor(idx)}
            style={styles.storySlot}
            activeOpacity={0.8}
          >
            <Text style={styles.storyText}>
              {story || `${idx + 1}. Tap to enter story`}
            </Text>
          </TouchableOpacity>
        ))}

        {stories.length >= 4 && (
          <View style={styles.storyButtonsRow}>
            {stories.length < MAX_STORIES && (
              <TouchableOpacity
                onPress={addStory}
                style={[styles.addButton, { flex: 1, marginRight: 6 }]}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={removeStory}
              style={[styles.addButton, { flex: 1, marginLeft: 6 }]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="minus"
                size={20}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.addButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {stories.length < 4 && stories.length < MAX_STORIES && (
          <TouchableOpacity
            onPress={addStory}
            style={styles.addButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="plus"
              size={20}
              color="#FFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addButtonText}>Add another story</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() =>
            router.push(`/${gameCode}/wait?user=${encodeURIComponent(user)}`)
          }
          style={[
            styles.submitButton,
            stories.filter((s) => s.trim()).length < MIN_STORIES && {
              opacity: 0.5,
            },
          ]}
          disabled={stories.filter((s) => s.trim()).length < MIN_STORIES}
        >
          <Text style={styles.submitText}>SUBMIT STORIES</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={editingIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingIndex(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Story {editingIndex !== null ? editingIndex + 1 : ""}
            </Text>
            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              placeholder="Type your story here…"
              multiline
              style={styles.modalInput}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setEditingIndex(null)}
                style={{ marginRight: 12 }}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEditor}
                style={styles.modalSaveButton}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: "center", marginBottom: 32 },
  codeText: { fontSize: 52, fontWeight: "bold", color: "#ccc" },
  waitingText: { fontSize: 16, color: "#aaa", marginTop: 4 },
  playerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  playerName: { fontSize: 18, color: "#fff" },
  sectionTitle: { color: "#fff", fontSize: 18, marginBottom: 12 },
  storySlot: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  storyText: { color: "#fff", fontSize: 16 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  addButtonText: { color: "#fff", fontSize: 16 },
  storyButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  modalInput: {
    height: 120,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  modalCancel: { fontSize: 16, color: "#555" },
  modalSaveButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalSaveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  pinLabel: {
    fontSize: 16,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
});
