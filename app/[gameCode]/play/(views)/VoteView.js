// app/[gameCode]/play/views/VoteView.js
import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGame } from "../../../../context/GameContext";

export default function VoteView() {
  const { gameCode } = useLocalSearchParams();
  const { state, dispatch, socket } = useGame();
  const { players, votes } = state;
  const [selected, setSelected] = useState(null);

  // Who hasn't voted yet?
  const waitingIds = players.map((p) => p.id).filter((id) => votes[id] == null);
  const waitingName =
    players.find((p) => p.id === waitingIds[0])?.username || "";

  // When you press an option
  const handleSelect = (id) => {
    setSelected(id);
  };

  // Send your vote to the server
  const finalize = () => {
    if (!selected) return;
    socket.emit("vote", { pin: gameCode, choiceId: selected });
  };

  // Render each player as a voting option
  const renderItem = ({ item }) => {
    const isSelected = item.id === selected;
    // gather all voters who chose this item
    const voters = Object.entries(votes)
      .filter(([, choiceId]) => choiceId === item.id)
      .map(([voterId]) => {
        const p = players.find((p) => p.id === voterId);
        return p ? p.username.charAt(0).toUpperCase() : "";
      });

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.id)}
        style={[styles.option, isSelected && styles.optionSelected]}
      >
        <Text
          style={[styles.optionText, isSelected && styles.optionTextSelected]}
        >
          {item.username}
        </Text>
        <View style={styles.voteIcons}>
          {voters.map((letter, i) => (
            <View key={i} style={styles.voteIcon}>
              <Text style={styles.voteIconText}>{letter}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.title}>VOTING PHASE</Text>
        <TouchableOpacity style={styles.scoreboard}>
          <Text style={styles.scoreboardText}>SCOREBOARD</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.waiting}>Waiting on {waitingName}...</Text>

      {/* card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CAST YOUR VOTE</Text>
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          style={styles.list}
        />

        <Text style={styles.youAre}>
          {selected
            ? `You are voting ${players.find((p) => p.id === selected)?.username}`
            : ""}
        </Text>

        <TouchableOpacity
          onPress={finalize}
          disabled={!selected}
          style={[styles.finalize, !selected && { opacity: 0.5 }]}
        >
          <Text style={styles.finalizeText}>FINALIZE</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.showStoryBtnView}>
        <TouchableOpacity
          onPress={() => dispatch({ type: "SHOW_STORY" })}
          style={styles.showStory}
        >
          <Text style={styles.showStoryText}>SHOW STORY</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const CARD_PADDING = 20;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1a0041",
    // justifyContent: "space-around",
    alignItems: "center",
    padding: 20,
  },
  header: {
    flex: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // marginVertical: 20,
  },
  waiting: {
    flex: 1,
    color: "#AAA",
    fontSize: 16,
    textAlign: "center",
    // marginVertical: 12,
  },
  card: {
    flex: 4,
    backgroundColor: "#15264F",
    borderRadius: 20,
    padding: CARD_PADDING,
    width: width - 40,
  },
  showStoryBtnView: {
    flex: 4,
    // backgroundColor: "red",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  showStory: {
    // flex: 4,
    marginTop: 24,
    alignSelf: "center",
    backgroundColor: "#3B82F6",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  title: {
    color: "#FFC700",
    fontSize: 24,
    fontWeight: "bold",
  },
  scoreboard: {
    borderColor: "#FFC700",
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  scoreboardText: {
    color: "#FFC700",
    fontSize: 14,
    fontWeight: "600",
  },

  cardTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  list: {
    marginBottom: 16,
  },

  option: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  optionText: {
    color: "#FFF",
    fontSize: 16,
  },
  optionTextSelected: {
    color: "#FFF",
    fontWeight: "600",
  },

  voteIcons: {
    flexDirection: "row",
    marginLeft: 8,
  },
  voteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFC700",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  voteIconText: {
    color: "#15264F",
    fontSize: 14,
    fontWeight: "bold",
  },

  youAre: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 12,
  },
  finalize: {
    backgroundColor: "#FF2E63",
    borderRadius: 24,
    paddingVertical: 12,
  },
  finalizeText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  showStoryText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
