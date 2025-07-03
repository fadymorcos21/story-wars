import { useGame } from "../../../../context/GameContext";

export default function RoundView() {
  const { state, socket, dispatch } = useGame();

  const onNext = () => {
    socket.emit("roundDone", state.round);
    // or just dispatch locally if you trust order
    dispatch({ type: "START_VOTE" });
  };

  return (
    <View>
      <Text>Round {state.round}</Text>
      <Text>{state.story}</Text>
      <Button title="Cast Votes" onPress={onNext} />
    </View>
  );
}
