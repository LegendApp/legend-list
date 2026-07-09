import CardsFlashList from "~/screens/fixtures/cards-flashlist";
import { FIXED_CARD_ITEM_SIZE } from "~/screens/fixtures/shared/cardsRenderItem";

export default function CardsFixedFlashListRoute() {
    return <CardsFlashList fixedItemSize={FIXED_CARD_ITEM_SIZE} />;
}
