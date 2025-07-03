import { useState } from "react";
import { useGame } from "../../../../context/GameContext";

export default function VoteView() {
  const { state, socket } = useGame();
  const [choice, setChoice] = useState(null);

  const submit = () => {
    socket.emit("vote", { pin: state.pin, choiceId: choice });
  };

  return (
    <View>
      <Text>Cast Your Vote</Text>
      {state.players.map((p) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => setChoice(p.id)}
          style={{ backgroundColor: choice === p.id ? "blue" : "transparent" }}
        >
          <Text>{p.username}</Text>
        </TouchableOpacity>
      ))}
      <Button title="Finalize" onPress={submit} disabled={!choice} />
    </View>
  );
}
